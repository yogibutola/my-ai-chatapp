import { Component, ChangeDetectionStrategy, signal, effect, ElementRef, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    /* Custom scrollbar for a cleaner look */
    .custom-scrollbar::-webkit-scrollbar {
      width: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: #f1f5f9; /* slate-100 */
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: #94a3b8; /* slate-400 */
      border-radius: 3px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: #64748b; /* slate-500 */
    }
    .fade-in {
      animation: fadeIn 0.5s ease-in-out;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `],
  template: `
    <!-- Main background -->
    <div class="bg-slate-100 dark:bg-slate-900 font-sans text-slate-800 dark:text-slate-200 flex items-center justify-center min-h-screen p-4">

      <!-- Chat Application Container -->
      <div class="w-full max-w-2xl h-[90vh] max-h-[700px] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl flex flex-col transition-all duration-300">

        <!-- Header -->
        <header class="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <div class="flex items-center space-x-3">
            <div class="p-2 bg-indigo-500 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h1 class="text-xl font-bold text-slate-700 dark:text-slate-200">Doc AI Assistant</h1>
          </div>
          @if (uploadedFile()) {
            <button (click)="clearSession()" class="text-sm text-indigo-500 hover:text-indigo-600 font-semibold transition-colors duration-200">
              Start Over
            </button>
          }
        </header>

        <!-- Main Content Area -->
        <main class="flex-grow flex flex-col p-4 overflow-y-hidden">
          @if (!uploadedFile()) {
            <!-- File Upload View -->
            <div class="w-full h-full flex flex-col items-center justify-center text-center p-8 fade-in">
              <div
                (dragover)="onDragOver($event)"
                (dragleave)="onDragLeave($event)"
                (drop)="onDrop($event)"
                class="w-full border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-10 cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors duration-300"
                [class.border-indigo-500]="isDragging()"
                [class.dark:border-indigo-400]="isDragging()"
                (click)="fileInput.click()">
                <input #fileInput type="file" class="hidden" (change)="onFileSelected($event)" accept=".pdf,.doc,.docx,.txt,.md">
                <div class="flex flex-col items-center justify-center space-y-4 text-slate-500 dark:text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p class="font-semibold">
                    <span class="text-indigo-500">Click to upload</span> or drag and drop
                  </p>
                  <p class="text-xs">Supports PDF, DOCX, TXT, MD</p>
                </div>
              </div>
            </div>
          } @else {
            <!-- Chat View -->
            <div class="flex flex-col h-full fade-in">
              <!-- File Info Header -->
              <div class="flex-shrink-0 bg-slate-50 dark:bg-slate-700 p-3 rounded-lg mb-4 text-sm text-slate-600 dark:text-slate-300 flex items-center justify-between">
                <div class="flex items-center space-x-2 truncate">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-indigo-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd" />
                  </svg>
                  <span class="font-medium truncate" [title]="uploadedFile()?.name">{{ uploadedFile()?.name }}</span>
                </div>
              </div>

              <!-- ✨ AI Suggested Questions -->
              @if (messages().length === 1 && !isLoading()) {
                  <div class="flex-shrink-0 mb-4 text-center">
                      <button (click)="generateSuggestedQuestions()" [disabled]="isLoadingSuggestions()" class="bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-300 px-4 py-2 rounded-full text-sm font-semibold hover:bg-violet-200 dark:hover:bg-violet-900/80 transition-colors duration-200 disabled:opacity-50 disabled:cursor-wait">
                          @if(isLoadingSuggestions()){
                              <span class="flex items-center">
                                  <svg class="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Generating...
                              </span>
                          } @else {
                              <span>✨ Suggest Questions</span>
                          }
                      </button>
                  </div>
              }

              @if (suggestedQuestions().length > 0 && !isLoading()) {
                  <div class="flex-shrink-0 mb-4 flex flex-wrap justify-center gap-2 fade-in">
                      @for(question of suggestedQuestions(); track question) {
                          <button (click)="askSuggestedQuestion(question)" class="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-full text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                              {{ question }}
                          </button>
                      }
                  </div>
              }

              <!-- Messages Container -->
              <div #chatContainer class="flex-grow overflow-y-auto pr-2 custom-scrollbar">
                <div class="flex flex-col space-y-4">
                  @for (message of messages(); track $index) {
                    <div class="flex" [class.justify-end]="message.sender === 'user'" [class.justify-start]="message.sender === 'ai'">
                      <div class="max-w-xs lg:max-w-md px-4 py-3 rounded-2xl" [class.bg-indigo-500]="message.sender === 'user'" [class.text-white]="message.sender === 'user'" [class.bg-slate-200]="message.sender === 'ai'" [class.dark:bg-slate-600]="message.sender === 'ai'" [class.dark:text-slate-200]="message.sender === 'ai'">
                        <p class="text-sm break-words" [innerHTML]="message.text"></p>
                      </div>
                    </div>
                  }
                  @if (isLoading()) {
                    <div class="flex justify-start">
                      <div class="max-w-xs lg:max-w-md px-4 py-3 rounded-2xl bg-slate-200 dark:bg-slate-600 dark:text-slate-200">
                        <div class="flex items-center space-x-2">
                          <span class="h-2 w-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                          <span class="h-2 w-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                          <span class="h-2 w-2 bg-indigo-400 rounded-full animate-bounce"></span>
                        </div>
                      </div>
                    </div>
                  }
                </div>
              </div>

              <!-- Input Form -->
              <div class="flex-shrink-0 pt-4">
                <form (submit)="sendMessage()">
                  <div class="flex items-center space-x-2 bg-slate-100 dark:bg-slate-700 rounded-full p-1">
                    <input
                      type="text"
                      [value]="userQuery()"
                      (input)="userQuery.set($event.target.value)"
                      placeholder="Ask a question about the document..."
                      class="w-full bg-transparent px-4 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none placeholder-slate-500 dark:placeholder-slate-400">
                    <button
                      type="submit"
                      [disabled]="isLoading() || userQuery().trim() === ''"
                      class="bg-indigo-500 text-white rounded-full p-2.5 hover:bg-indigo-600 disabled:bg-slate-400 disabled:dark:bg-slate-500 disabled:cursor-not-allowed transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.428A1 1 0 009.898 16.11l.222-1.417a2 2 0 01.355-.544l8.48-8.48a.75.75 0 000-1.06l-4.37-4.37a.75.75 0 00-1.06 0l-8.48 8.48a2 2 0 01-.544.355l-1.417.222a1 1 0 00-.282.282l-1.428 5a1 1 0 001.409 1.169l14-7a1 1 0 000-1.788l-7-14z" />
                      </svg>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          }
        </main>
      </div>
    </div>
  `
})
export class App {
  // --- STATE MANAGEMENT ---
  uploadedFile = signal<File | null>(null);
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
    this.uploadedFile.set(file);
    this.messages.set([{
      sender: 'ai',
      text: `File "<b>${this.escapeHtml(file.name)}</b>" is ready. What would you like to know?`
    }]);
    this.suggestedQuestions.set([]); // Clear previous suggestions
  }

  askSuggestedQuestion(question: string): void {
    this.userQuery.set(question);
    this.sendMessage();
  }

  async sendMessage(): Promise<void> {
    const query = this.userQuery().trim();
    if (query === '' || this.isLoading()) return;

    this.suggestedQuestions.set([]); // Hide suggestions after asking

    this.messages.update(msgs => [...msgs, { sender: 'user', text: this.escapeHtml(query) }]);
    this.userQuery.set('');
    this.isLoading.set(true);

    try {
      const aiResponse = await this.callGeminiApi(query, this.uploadedFile()!);
      this.messages.update(msgs => [...msgs, { sender: 'ai', text: aiResponse }]);
    } catch (error) {
      console.error("AI API Error:", error);
      this.messages.update(msgs => [...msgs, {
        sender: 'ai',
        text: "Sorry, I encountered an error. Please try again."
      }]);
    } finally {
      this.isLoading.set(false);
    }
  }

  clearSession(): void {
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
      const apiKey = ""; // This is handled by the execution environment.
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

      const systemPrompt = "You are an AI assistant. Your task is to generate three insightful, concise, and distinct questions a user might ask about a document, based on its title. Format the output as a JSON array of strings.";
      const userQuery = `Document Title: "${file.name}"`;

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

