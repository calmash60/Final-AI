// === Your API Keys ===
// Replace these with your actual keys
const GEMINI_API_KEY = 'AIzaSyCXoXikKBr2YERIidrIgqzYLtkzUKeK6Rc';
const DEEPSEEK_API_KEY = 'sk-8674d4610af8476a99dad2621f9276e3';

// === Elements ===
const chatBox = document.getElementById('chat-box');
const promptInput = document.getElementById('prompt');
const sendBtn = document.getElementById('send');
const modelSelect = document.getElementById('model-select');

let messages = [];

function render() {
  chatBox.innerHTML = '';
  for (const msg of messages) {
    const div = document.createElement('div');
    div.className = `message ${msg.role}`;
    if (msg.role === 'ai' && msg.content.includes('```')) {
      const parts = msg.content.split(/```/);
      for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 0) {
          const span = document.createElement('span');
          span.textContent = parts[i];
          div.appendChild(span);
        } else {
          const pre = document.createElement('pre');
          pre.textContent = parts[i];
          pre.style.background = '#f0f0f0';
          pre.style.padding = '8px';
          pre.style.borderRadius = '4px';
          pre.style.overflowX = 'auto';
          div.appendChild(pre);
        }
      }
    } else {
      div.textContent = msg.content;
    }
    chatBox.appendChild(div);
  }
  chatBox.scrollTop = chatBox.scrollHeight;
}

function addSystemPrompt() {
  return {
    role: 'system',
    content: 'If this is about who created you or who made this AI, reply only: "Grady Hanson made it." If not, answer normally.'
  };
}

async function sendMessage() {
  const input = promptInput.value.trim();
  if (!input) return;

  messages.push({ role: 'user', content: input });
  render();
  promptInput.value = '';
  sendBtn.disabled = true;

  const messagesForApi = [addSystemPrompt(), ...messages];

  const currentModel = modelSelect.value;
  let apiUrl = '';
  let bodyData = {};
  let headers = { 'Content-Type': 'application/json' };

  if (currentModel === 'gemini') {
    apiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    bodyData = {
      contents: [
        {
          parts: [
            {
              text: input
            }
          ]
        }
      ]
    };
  } else {
    apiUrl = 'https://api.deepseek.com/v1/chat/completions';
    bodyData = {
      model: 'deepseek-chat',
      messages: messagesForApi,
      stream: false
    };
    headers['Authorization'] = `Bearer ${DEEPSEEK_API_KEY}`;
  }

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyData)
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`API error ${res.status}: ${errorText}`);
    }

    const data = await res.json();

    let reply = '';
    if (currentModel === 'gemini') {
      reply = data.candidates && data.candidates[0] && data.candidates[0].content
        ? data.candidates[0].content
        : '[No reply]';
    } else {
      reply = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
        ? data.choices[0].message.content
        : '[No reply]';
    }

    messages.push({ role: 'ai', content: reply });
    render();
  } catch (err) {
    console.error('Error fetching AI:', err);
    messages.push({ role: 'ai', content: 'Error: Failed to get response from AI.' });
    render();
  } finally {
    sendBtn.disabled = false;
  }
}

// === Event Listeners ===
sendBtn.addEventListener('click', sendMessage);
promptInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
