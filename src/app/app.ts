import { Component, ChangeDetectionStrategy, signal, effect, ElementRef, viewChild, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common'; // Re-adding imports


interface ServerFile {
  name: string;
  size: string;
  date: string;
  selected?: boolean;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './app.scss',
  templateUrl: './app.html'
})
export class App {
  private cdr = inject(ChangeDetectorRef);

  // --- STATE MANAGEMENT ---
  uploadedFiles = signal<File[]>([]);
  errorMessage = signal<string | null>(null);
  isUploading = signal<boolean>(false);
  uploadedFile = signal<File | null>(null);
  selectedFiles = signal<File[]>([]);
  messages = signal<{ sender: 'user' | 'ai'; text: string }[]>([]);
  isLoading = signal<boolean>(false);
  userQuery = signal<string>('');
  isDragging = signal<boolean>(false);
  isLoadingSuggestions = signal<boolean>(false);
  suggestedQuestions = signal<string[]>([]);

  // Browsing State
  isBrowsing = signal<boolean>(false);
  serverFiles = signal<ServerFile[]>([]);
  searchQuery = signal<string>('');
  selectedServerFiles = signal<Set<string>>(new Set());

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
    if (this.isUploading()) return;

    this.isUploading.set(true);
    this.errorMessage.set(null);
    this.cdr.detectChanges();
    console.log('Upload started...');

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
      this.showError('All selected files are already uploaded.');
      this.isUploading.set(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 1 minute timeout

    try {
      const response = await fetch(UPLOAD_ENDPOINT, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const result = await response.json();
        this.uploadedFiles.update(list => [...list, ...newFiles]);
        console.log("Upload Success:", result);
      } else {
        let errorText = `Upload failed with status code ${response.status}.`;
        try {
          const errorBody = await response.json();
          errorText += ` ${errorBody.error || errorBody.message || ''}`;
        } catch (e) {
          // The server might not return JSON on error
        }
        console.error(errorText);
        this.showError(errorText);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        this.showError('Upload timed out (1 minute limit). Please try again.');
      } else {
        console.error("Network or Fetch Error:", error);
        this.showError('Upload failed due to network error.');
      }
    } finally {
      this.isUploading.set(false);
      this.cdr.detectChanges();
      input.value = '';
    }
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
      this.showError('Sorry, I encountered an error. Please try again.');
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
    this.isLoadingSuggestions.set(false);
    this.errorMessage.set(null);
  }

  showError(message: string): void {
    this.errorMessage.set(message);
    this.cdr.detectChanges();
    setTimeout(() => {
      if (this.errorMessage() === message) {
        this.errorMessage.set(null);
        this.cdr.detectChanges();
      }
    }, 60000);
  }

  // --- BROWSING METHODS ---

  openBrowseModal(): void {
    this.isBrowsing.set(true);
    this.selectedServerFiles.set(new Set()); // Reset selection
    this.searchQuery.set('');
    this.fetchServerFiles();
  }

  closeBrowseModal(): void {
    this.isBrowsing.set(false);
  }

  /** Fetch files from server */
  async fetchServerFiles(query: string = ''): Promise<void> {
    try {
      // Use query param for server-side filtering if supported, otherwise we filter client-side
      const URL = `/api/v1/list_files/`;
      const response = await fetch(URL);

      if (!response.ok) {
        throw new Error(`Failed to list files: ${response.statusText}`);
      }

      const data = await response.json(); // Expecting array of objects or strings

      if (Array.isArray(data)) {
        // Map response to ServerFile interface
        const mappedFiles: ServerFile[] = data.map((item: any) => {
          // Handle if item is just a string (filename) or object
          const name = typeof item === 'string' ? item : (item.name || item.filename || 'Unknown');
          return {
            name: name,
            size: item.size || 'Unknown',
            date: item.date || item.created_at || new Date().toISOString().split('T')[0]
          };
        });

        // Client-side filter for search query (since we are fetching all)
        if (query.trim()) {
          const lowerQuery = query.toLowerCase();
          const filtered = mappedFiles.filter(f => f.name.toLowerCase().includes(lowerQuery));
          this.serverFiles.set(filtered);
        } else {
          this.serverFiles.set(mappedFiles);
        }
      } else {
        console.warn('Unexpected API response format', data);
        this.serverFiles.set([]);
      }

    } catch (error) {
      console.error('Error fetching server files:', error);
      this.showError('Could not retrieve server files.');
      this.serverFiles.set([]);
    }
  }

  onSearchQueryChange(event: Event): void {
    const query = (event.target as HTMLInputElement).value;
    this.searchQuery.set(query);
    this.fetchServerFiles(query);
  }

  toggleServerFileSelection(fileName: string): void {
    this.selectedServerFiles.update(set => {
      const newSet = new Set(set);
      if (newSet.has(fileName)) {
        newSet.delete(fileName);
      } else {
        newSet.add(fileName);
      }
      return newSet;
    });
  }

  isServerFileSelected(fileName: string): boolean {
    return this.selectedServerFiles().has(fileName);
  }

  importSelectedFiles(): void {
    const selectedNames = this.selectedServerFiles();
    const filesToImport = this.serverFiles().filter(f => selectedNames.has(f.name));

    // Mock converting ServerFile to File object (this is a simulation)
    const importedFiles = filesToImport.map(sf => {
      // We create a dummy File object appropriately
      // Using a trick to creating a File from nothing (blob)
      const blob = new Blob(["(Mock Content)"], { type: 'text/plain' });
      return new File([blob], sf.name, { type: 'application/octet-stream' });
    });

    // Filter out duplicates that are already uploaded
    const newFiles = importedFiles.filter(f => !this.uploadedFiles().some(existing => existing.name === f.name));

    if (newFiles.length > 0) {
      this.uploadedFiles.update(list => [...list, ...newFiles]);
      this.selectFile(newFiles[0]); // Select the first new file
    }

    this.closeBrowseModal();
  }

  /** Delete a single file from the server */
  async deleteServerFile(fileName: string): Promise<boolean> {
    try {
      const URL = `/api/v1/delete_file/?filename=${fileName}`;
      const response = await fetch(URL, { method: 'DELETE' });
      if (!response.ok) {
        console.error(`Failed to delete ${fileName}: ${response.statusText}`);
        return false;
      }
      return true;
    } catch (error) {
      console.error(`Error deleting ${fileName}:`, error);
      return false;
    }
  }

  /** Delete all selected files */
  async deleteSelectedFiles(): Promise<void> {
    const selectedNames = Array.from(this.selectedServerFiles());
    if (selectedNames.length === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedNames.length} file(s)? This cannot be undone.`)) {
      return;
    }

    this.isBrowsing.set(false); // Temporarily close or show loading state? keeping it simple.
    // Better to show loading.

    let deletedCount = 0;

    // Execute deletions
    // We run them sequentially or parallel. Parallel is faster.
    const deletionPromises = selectedNames.map(name => this.deleteServerFile(name));
    const results = await Promise.all(deletionPromises);

    deletedCount = results.filter(success => success).length;

    if (deletedCount > 0) {
      this.showError(`Successfully deleted ${deletedCount} file(s).`);
      // Refresh list
      // Reset selection
      this.selectedServerFiles.set(new Set());
      this.isBrowsing.set(true); // Re-open if we closed it, or just refresh
      await this.fetchServerFiles(this.searchQuery());
    } else {
      this.showError('Failed to delete files.');
      this.isBrowsing.set(true);
    }
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

