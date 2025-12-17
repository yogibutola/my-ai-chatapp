import { Component, ChangeDetectionStrategy, signal, effect, ElementRef, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './app.scss',
  templateUrl: './app.html'
})
export class App {
  // --- STATE MANAGEMENT ---
  uploadedFiles = signal<File[]>([]);
  uploadedFile = signal<File | null>(null);
  selectedFiles = signal<File[]>([]);
  messages = signal<{ sender: 'user' | 'ai'; text: string }[]>([]);
  isLoading = signal<boolean>(false);
  userQuery = signal<string>('');
  isDragging = signal<boolean>(false);
  isLoadingSuggestions = signal<boolean>(false);
  suggestedQuestions = signal<string[]>([]);
  // Access to the chat container element for scrolling
  chatContainer = viewChild<ElementRef<HTMLDivElement>>('chatContainer');

  constructor() {
    // Effect to auto-scroll when new messages are added
    effect(() => {
      if (this.messages() && this.chatContainer()) {
        this.scrollToBottom();
      }
    });
  }

  // --- UI EVENT HANDLERS ---
  onFileSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      this.handleFileUpload(file);
      this.addUploadedFile(file);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) {
      this.handleFileUpload(file);
    }
  }

  handleFileUpload(file: File): void {
    //  this.uploadFile(file)
    this.uploadedFile.set(file);
    this.messages.set([{
      sender: 'ai',
      text: `File "<b>${this.escapeHtml(file.name)}</b>" is ready. What would you like to know?`
    }]);
    this.suggestedQuestions.set([]); // Clear previous suggestions
  }

  /** ✅ Adds new file to uploaded list & sets it active */
  addUploadedFile(file: File): void {
    const exists = this.uploadedFiles().some(f => f.name === file.name);
    if (!exists) {
      this.uploadedFiles.update(list => [...list, file]);
    }
    this.uploadedFile.set(file);
    this.messages.set([]); // clear chat for the new file
  }

  async uploadFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = input.files;

    if (!files || files.length === 0) return;
    const UPLOAD_ENDPOINT = "/api/v1/upload-files/";
    const filesArray = Array.from(files);

    // Filter out duplicates
    const newFiles = filesArray.filter(
      f => !this.uploadedFiles().some(existing => existing.name === f.name)
    );

    // Prepare FormData (send all files together)
    const formData = new FormData();
    for (const file of newFiles) {
      formData.append('files', file); // Note plural key: 'files'
      this.uploadedFile.set(file);
    }

    if (newFiles.length === 0) {
      console.warn('All selected files are already uploaded.');
      return;
    }

    try {
      const response = await fetch(UPLOAD_ENDPOINT, {
        method: 'POST',
        // Note: When using FormData, you typically do NOT set the 'Content-Type': 'multipart/form-data' header.
        // The browser handles setting the correct boundary automatically.
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        this.uploadedFiles.update(list => [...list, ...newFiles]);
        console.log("Upload Success:", result);
      } else {
        let errorText = `Upload failed with status code ${response.status}.`;
        try {
          const errorBody = await response.json();
          errorText += ` Server error: ${errorBody.error || errorBody.message || 'Unknown server error'}`;
        } catch (e) {
          // The server might not return JSON on error
          errorText += ' Could not parse error response.';
        }
        console.error(errorText);
      }
    } catch (error) {
      console.error("Network or Fetch Error:", error);
    } finally {
      // Re-enable the button but only if a file is still selected
      //           if (fileInput.files.length > 0) {
      //              // uploadButton.disabled = false;
      //           }
    }
    // console.log(`File "${file.name}" uploaded.`);
  }

  askSuggestedQuestion(question: string): void {
    this.userQuery.set(question);
    //this.sendMessage();
  }

  async sendMessage(event: Event): Promise<void> {
    event.preventDefault();
    const query = this.userQuery().trim();
    if (query === '' || this.isLoading()) return;

    this.suggestedQuestions.set([]); // Hide suggestions after asking
    this.messages.update(msgs => [...msgs, { sender: 'user', text: this.escapeHtml(query) }]);
    this.userQuery.set('');
    this.isLoading.set(true);

    const file = this.uploadedFile();
    try {
      const activeDocs = this.selectedFiles();
      const names = activeDocs.map(f => f.name).join(', ');
      const URL = `/api/v1/ask_question/?documents=${encodeURIComponent(names)}&query=${encodeURIComponent(query)}`;

      const response = await fetch(URL, {
        method: 'GET', headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        // Throw an error with the status code and text
        throw new Error(`HTTP error! Status: ${response.status} - ${response.statusText}`);
      }
      const data = await response.json();
      this.messages.update(msgs => [...msgs, { sender: 'ai', text: data.answer }]);
    } catch (error) {
      if (error instanceof Error) {
        console.error("Fetch error:", error);
      }
      console.log("AI API Error:", error);
      this.messages.update(msgs => [...msgs, {
        sender: 'ai',
        text: "Sorry, I encountered an error. Please try again."
      }]);
    } finally {
      this.isLoading.set(false);
      this.scrollToBottom();
    }
  }

  /** ✅ Selects a different file from sidebar */
  selectFile(file: File): void {
    this.uploadedFile.set(file);
    // this.messages.set([]); // reset chat for the selected file
    this.userQuery.set('');
  }


  /** ✅ Apply button — load first selected file (or handle multi-file logic) */
  applyFileSelection(): void {
    if (this.selectedFiles().length === 0) return;

    // If only one file, just select it
    if (this.selectedFiles().length === 1) {
      this.uploadedFile.set(this.selectedFiles()[0]);
      this.messages.set([]);
      return;
    }

    // 🔥 Example: when multiple selected files — you can handle combined queries here
    this.uploadedFile.set(null);
    this.messages.set([
      { sender: 'ai', text: `You selected ${this.selectedFiles().length} documents.` }
    ]);
  }

  /** ✅ Toggles checkbox for a file */
  toggleFileSelection(file: File, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.selectedFiles.update(list => [...list, file]);
    } else {
      this.selectedFiles.update(list => list.filter(f => f.name !== file.name));
    }
  }


  /** ✅ Utility: returns whether a file is checked */
  isFileSelected(file: File): boolean {
    return this.selectedFiles().some(f => f.name === file.name);
  }

  get selectedFileNames(): string {
    const files = this.selectedFiles?.() ?? [];
    return files.length ? files.map(f => f.name).join(', ') : 'No file selected';
  }

  /** ✅ Clears all state (for Start Over button) */
  clearSession(): void {
    this.uploadedFiles.set([]);
    this.uploadedFile.set(null);
    this.messages.set([]);
    this.userQuery.set('');
    this.isLoading.set(false);
    this.suggestedQuestions.set([]);
    this.isLoadingSuggestions.set(false);
  }

  // --- UTILITY METHODS ---
  private scrollToBottom(): void {
    setTimeout(() => {
      const container = this.chatContainer()?.nativeElement;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 0);
  }

  private escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // --- GEMINI API INTEGRATION ---

  /**
   * Generates suggested questions based on the document title using the Gemini API.
   */
  async generateSuggestedQuestions(): Promise<void> {
    if (!this.uploadedFile() || this.isLoadingSuggestions()) return;

    this.isLoadingSuggestions.set(true);
    this.suggestedQuestions.set([]);

    const file = this.uploadedFile()!;
    const apiKey = "AIzaSyBmAhm92nCmqKSevcSeQJE5-Y0c1uQLzLM"; // This is handled by the execution environment.
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    const systemPrompt = "You are an AI assistant. Your task is to generate three insightful, concise, and distinct questions a user might ask about a document, based on its title. Format the output as a JSON array of strings.";
    const userQuery = "";//`Document Title: "${file.name}"`;

    const payload = {
      contents: [{ parts: [{ text: userQuery }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: { type: "ARRAY", items: { type: "STRING" } }
      }
    };

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error(`API call failed: ${response.status}`);

      const result = await response.json();
      const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (jsonText) {
        this.suggestedQuestions.set(JSON.parse(jsonText));
      } else {
        throw new Error("No content in API response.");
      }
    } catch (error) {
      console.error("Error generating suggested questions:", error);
      this.suggestedQuestions.set(["Summarize the document.", "What are the key takeaways?", "Explain the main topic."]);
    } finally {
      this.isLoadingSuggestions.set(false);
    }
  }

  /**
   * Calls the Gemini API to get an answer to a user's query about the document.
   * Implements exponential backoff for retries.
   */
  private async callGeminiApi(query: string, file: File): Promise<string> {
    const apiKey = ""; // This is handled by the execution environment.
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    const systemPrompt = "You are an expert AI assistant. A user has uploaded a document and is asking a question. Your answer must be based on the context of the document title and the user's query. Use basic HTML like <b> for emphasis; do not use markdown.";
    const userQuery = `Based on the document titled "<b>${this.escapeHtml(file.name)}</b>", please answer: "${this.escapeHtml(query)}"`;

    const payload = {
      contents: [{ parts: [{ text: userQuery }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
    };

    let attempts = 0;
    const maxAttempts = 4;
    while (attempts < maxAttempts) {
      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          const result = await response.json();
          const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
          return text || "I'm sorry, I couldn't generate a response. Please try again.";
        } else if (response.status === 429 || response.status >= 500) {
          // Retry on server errors or throttling
          attempts++;
          if (attempts >= maxAttempts) break;
          const delay = (2 ** attempts) * 1000 + Math.random() * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // Don't retry on other client-side errors
          return `An error occurred with the AI service (Status: ${response.status}).`;
        }
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) break;
        const delay = (2 ** attempts) * 1000 + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    return "I'm having trouble connecting to the AI service. Please try again later.";
  }
}

