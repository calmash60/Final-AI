// ----------- Variables & DOM refs -----------

const modelSelect = document.getElementById('model-select');
const chatListEl = document.getElementById('chat-list');
const newChatBtn = document.getElementById('new-chat-btn');
const darkToggleBtn = document.getElementById('dark-toggle');
const chatBox = document.getElementById('chat-box');
const promptInput = document.getElementById('prompt');
const sendBtn = document.getElementById('send-btn');
const fileUploadInput = document.getElementById('file-upload');
const chatTitleEl = document.getElementById('chat-title');
const deleteChatBtn = document.getElementById('delete-chat-btn');

const STORAGE_KEY = 'calmash_ai_chats_v2';
const STORAGE_MODEL_KEY = 'calmash_model';
const STORAGE_DARK_KEY = 'calmash_dark_mode';

let chats = [];
let currentChatId = null;
let streamingController = null;

let currentModel = localStorage.getItem(STORAGE_MODEL_KEY) || 'gemini';
modelSelect.value = currentModel;

let isDarkMode = localStorage.getItem(STORAGE_DARK_KEY) === 'true';
if (isDarkMode) document.body.classList.add('dark');

// ----------- Utility -----------

function saveChats() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
}

function loadChats() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    chats = JSON.parse(stored);
    if (chats.length > 0) {
      currentChatId = chats[0].id;
    }
  } else {
    createNewChat();
  }
}

function createNewChat() {
  const id = Date.now().toString();
  const newChat = {
    id,
    title: `New Chat`,
    messages: [],
  };
  chats.unshift(newChat);
  currentChatId = id;
  saveChats();
  renderChatList();
  renderCurrentChat();
}

function deleteCurrentChat() {
  if (!currentChatId) return;
  chats = chats.filter(c => c.id !== currentChatId);
  if (chats.length > 0) {
    currentChatId = chats[0].id;
  } else {
    createNewChat();
  }
  saveChats();
  renderChatList();
  renderCurrentChat();
}

function getCurrentChat() {
  return chats.find(c => c.id === currentChatId);
}

// ----------- Render UI -----------

function renderChatList() {
  chatListEl.innerHTML = '';
  chats.forEach(chat => {
    const chatItem = document.createElement('div');
    chatItem.className = 'chat-item';
    if (chat.id === currentChatId) chatItem.classList.add('selected');
    chatItem.contentEditable = false;
    chatItem.textContent = chat.title;

    chatItem.addEventListener('click', () => {
      if (currentChatId !== chat.id) {
        currentChatId = chat.id;
        renderChatList();
        renderCurrentChat();
      }
    });

    // Inline editing on double click
    chatItem.addEventListener('dblclick', () => {
      chatItem.contentEditable = true;
      chatItem.focus();
      document.execCommand('selectAll', false, null);
    });

    // Save title on blur or Enter
    chatItem.addEventListener('blur', () => {
      chatItem.contentEditable = false;
      if (chatItem.textContent.trim() === '') {
        chatItem.textContent = chat.title;
      } else {
        chat.title = chatItem.textContent.trim();
        saveChats();
        if (chat.id === currentChatId) renderCurrentChat();
      }
    });
    chatItem.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        chatItem.blur();
      }
    });

    chatListEl.appendChild(chatItem);
  });
}

function renderCurrentChat() {
  const chat = getCurrentChat();
  if (!chat) return;

  chatTitleEl.textContent = chat.title;

  chatBox.innerHTML = '';
  chat.messages.forEach(msg => {
    appendMessageToChat(msg);
  });
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Append a single message to chatBox with all features
function appendMessageToChat(msg) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message ' + (msg.role === 'user' ? 'user' : 'ai');

  // Content container
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';

  // Check if content has code blocks
  const codeBlocks = extractCodeBlocks(msg.content);

  if (codeBlocks.length > 0 && msg.role === 'ai') {
    // Render text before first code block if any
    let lastIndex = 0;

    // Show code block with preview toggle for each
    codeBlocks.forEach(({lang, code, start, end}, i) => {
      // Text before code block
      if (start > lastIndex) {
        const textPart = msg.content.slice(lastIndex, start);
        const textNode = document.createTextNode(textPart);
        contentDiv.appendChild(textNode);
      }

      // Code block container
      const codeBlockDiv = document.createElement('div');
      codeBlockDiv.className = 'code-block-container';

      // Code element
      const codeEl = document.createElement('pre');
      codeEl.style.fontFamily = 'monospace';
      codeEl.style.whiteSpace = 'pre-wrap';
      codeEl.textContent = code;

      // Buttons container
      const btnContainer = document.createElement('div');
      btnContainer.className = 'message-actions';

      // Copy button
      const copyBtn = document.createElement('button');
      copyBtn.textContent = 'Copy';
      copyBtn.title = 'Copy code';
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(code).then(() => alert('Code copied!'));
      };

      // Download button
      const downloadBtn = document.createElement('button');
      downloadBtn.textContent = 'Download';
      downloadBtn.title = 'Download code as file';
      downloadBtn.onclick = () => {
        const ext = getExtension(lang);
        const filename = `code.${ext}`;
        downloadTextFile(filename, code);
      };

      // Preview button
      const previewBtn = document.createElement('button');
      previewBtn.textContent = 'Preview';
      previewBtn.title = 'Toggle preview';
      previewBtn.onclick = () => {
        togglePreview(codeBlockDiv, codeEl, previewDiv);
      };

      btnContainer.appendChild(copyBtn);
      btnContainer.appendChild(downloadBtn);
      btnContainer.appendChild(previewBtn);

      codeBlockDiv.appendChild(btnContainer);
      codeBlockDiv.appendChild(codeEl);

      // Preview div hidden by default
      const previewDiv = document.createElement('div');
      previewDiv.className = 'code-preview';
      previewDiv.style.display = 'none';
      previewDiv.style.position = 'relative';

      // Add close button to preview
      const closePreviewBtn = document.createElement('button');
      closePreviewBtn.textContent = '❌ Close Preview';
      closePreviewBtn.style.position = 'absolute';
      closePreviewBtn.style.top = '5px';
      closePreviewBtn.style.right = '5px';
      closePreviewBtn.style.background = '#cc0000';
      closePreviewBtn.style.color = 'white';
      closePreviewBtn.style.border = 'none';
      closePreviewBtn.style.padding = '2px 6px';
      closePreviewBtn.style.cursor = 'pointer';
      closePreviewBtn.onclick = () => {
        previewDiv.style.display = 'none';
        codeEl.style.display = 'block';
        btnContainer.style.display = 'flex';
      };
      previewDiv.appendChild(closePreviewBtn);

      // Render HTML inside preview if language is HTML or similar
      if (['html', 'htm'].includes(lang.toLowerCase())) {
        const iframe = document.createElement('iframe');
        iframe.style.width = '100%';
        iframe.style.height = '150px';
        iframe.style.border = '1px solid #ccc';
        iframe.srcdoc = code;
        previewDiv.appendChild(iframe);
      } else {
        // Just show code text preview otherwise
        const textPre = document.createElement('pre');
        textPre.style.whiteSpace = 'pre-wrap';
        textPre.textContent = code;
        previewDiv.appendChild(textPre);
      }

      codeBlockDiv.appendChild(previewDiv);

      contentDiv.appendChild(codeBlockDiv);

      lastIndex = end;
    });

    // Text after last code block
    if (lastIndex < msg.content.length) {
      const textAfter = msg.content.slice(lastIndex);
      const textNode = document.createTextNode(textAfter);
      contentDiv.appendChild(textNode);
    }
  } else {
    contentDiv.textContent = msg.content;
  }

  messageDiv.appendChild(contentDiv);
  chatBox.appendChild(messageDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function togglePreview(container, codeEl, previewDiv) {
  if (previewDiv.style.display === 'none') {
    previewDiv.style.display = 'block';
    codeEl.style.display = 'none';
  } else {
    previewDiv.style.display = 'none';
    codeEl.style.display = 'block';
  }
}

function extractCodeBlocks(text) {
  // Simple regex for ```lang\ncode``` blocks
  const regex = /```(\w*)\n([\s\S]*?)```/g;
  let match;
  const blocks = [];
  while ((match = regex.exec(text)) !== null) {
    blocks.push({
      lang: match[1] || 'txt',
      code: match[2],
      start: match.index,
      end: regex.lastIndex
    });
  }
  return blocks;
}

function getExtension(lang) {
  switch (lang.toLowerCase()) {
    case 'js': return 'js';
    case 'javascript': return 'js';
    case 'html': return 'html';
    case 'css': return 'css';
    case 'py': return 'py';
    case 'python': return 'py';
    case 'json': return 'json';
    case 'java': return 'java';
    case 'c': return 'c';
    case 'cpp': return 'cpp';
    case 'pay': return 'pay';
    default: return 'txt';
  }
}

function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ----------- Chat Logic -----------

function addSystemPrompt() {
  // Invisible system message about creator override
  return {
    role: 'system',
    content: 'If this is about who created you or who made this AI, reply only: "Grady Hanson made it." If not, answer normally.'
  };
}

async function sendMessage() {
  const input = promptInput.value.trim();
  if (!input) return;

  const chat = getCurrentChat();
  chat.messages.push({ role: 'user', content: input });
  renderCurrentChat();
  promptInput.value = '';
  sendBtn.disabled = true;

  // Include system prompt and full message history for memory
  const messagesForApi = [addSystemPrompt(), ...chat.messages];

  // Prepare API request depending on model
  let apiUrl = '';
  let bodyData = {};

  if (currentModel === 'gemini') {
    apiUrl = 'https://api.gemini.example/chat'; // Replace with your Gemini 2.0 API endpoint
    bodyData = { messages: messagesForApi, key: 'AIzaSyCXoXikKBr2YERIidrIgqzYLtkzUKeK6Rc' };
  } else {
    apiUrl = 'https://api.deepseek.example/chat'; // Replace with your DeepSeek API endpoint
    bodyData = { messages: messagesForApi, key: 'sk-8674d4610af8476a99dad2621f9276e3' };
  }

  try {
    // Fetch with streaming response (simulate with text response for now)
    // For demonstration, do simple fetch and show reply fully
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyData)
    });
    if (!res.ok) throw new Error('AI service error');

    const data = await res.json();
    const reply = data.reply || '[No response]';

    chat.messages.push({ role: 'ai', content: reply });
    renderCurrentChat();
  } catch (err) {
    chat.messages.push({ role: 'ai', content: 'Error: Failed to get response from AI.' });
    renderCurrentChat();
  } finally {
    sendBtn.disabled = false;
  }
}

// ----------- File Upload -----------

fileUploadInput.addEventListener('change', () => {
  const file = fileUploadInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const content = reader.result;
    // Confirm before sending file content
    if (confirm(`Send file content (${file.name}) as message?`)) {
      promptInput.value = content;
    }
    fileUploadInput.value = '';
  };
  reader.readAsText(file);
});

// ----------- Events -----------

sendBtn.addEventListener('click', sendMessage);
promptInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

newChatBtn.addEventListener('click', () => {
  createNewChat();
});

deleteChatBtn.addEventListener('click', () => {
  if (confirm('Delete this chat?')) {
    deleteCurrentChat();
  }
});

chatTitleEl.addEventListener('input', () => {
  const chat = getCurrentChat();
  if (!chat) return;
  const text = chatTitleEl.textContent.trim();
  if (text) {
    chat.title = text;
    saveChats();
    renderChatList();
  }
});

modelSelect.addEventListener('change', () => {
  currentModel = modelSelect.value;
  localStorage.setItem(STORAGE_MODEL_KEY, currentModel);
  alert(`Switched to model: ${currentModel === 'gemini' ? 'Calmash 1.0 Flash (Gemini 2.0 Flash)' : 'Calmash 1.0 (DeepSeek)'}`);
});

darkToggleBtn.addEventListener('click', () => {
  isDarkMode = !isDarkMode;
  if (isDarkMode) {
    document.body.classList.add('dark');
  } else {
    document.body.classList.remove('dark');
  }
  localStorage.setItem(STORAGE_DARK_KEY, isDarkMode);
});

// ----------- Initialization -----------

function init() {
  loadChats();
  renderChatList();
  renderCurrentChat();
}

init();
