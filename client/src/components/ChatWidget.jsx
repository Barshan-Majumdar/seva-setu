import { useState, useRef, useEffect } from 'react';
import api from '../services/api';

const BOT_ICON = '/sevabot-icon.png';

// ── SVG Icons ──────────────────────────────────────────────────────────────

const Icons = {
  User: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  Send: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  ),
  Close: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Sparkles: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" /><path d="M3 5h4" /><path d="M21 17v4" /><path d="M19 19h4" />
    </svg>
  )
};

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'model',
      text: "Hello. I am SevaBot, your SevaSetu assistant. I can help you answer questions, provide regional updates, or guide you through our coordination platform. How may I assist you today?"
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (textOverride) => {
    const text = (textOverride || input).trim();
    if (!text || loading) return;

    const userMsg = { role: 'user', text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const historyToSend = newMessages.slice(1);
      const { data } = await api.post('/chat', {
        message: text,
        history: historyToSend.slice(0, -1)
      });

      setMessages(prev => [...prev, { role: 'model', text: data.reply }]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: 'model', text: 'I encountered an error while processing your request. Please try again shortly.' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        onClick={() => setIsOpen(o => !o)}
        className="chat-trigger-btn"
        style={{
          position: 'fixed', bottom: '32px', right: '32px', zIndex: 9999,
          width: '60px', height: '60px', borderRadius: '20px',
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          cursor: 'pointer',
          boxShadow: '0 12px 40px rgba(0,0,0,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          padding: '0', overflow: 'hidden',
          transform: isOpen ? 'rotate(90deg)' : 'none'
        }}
        title="SevaBot Assistant"
      >
        {isOpen ? (
          <div style={{ color: '#0f172a' }}><Icons.Close /></div>
        ) : (
          <div style={{ width: '100%', height: '100%', padding: '0' }}>
            <img 
              src={BOT_ICON} 
              alt="SevaBot" 
              style={{ 
                width: '100%', height: '100%', objectFit: 'cover',
                mixBlendMode: 'multiply'
              }} 
            />
          </div>

        )}
      </button>

      <style>{`
        .chat-trigger-btn:hover {
          transform: scale(1.05) ${isOpen ? 'rotate(90deg)' : ''} !important;
          background: #ffffff !important;
          box-shadow: 0 15px 45px rgba(0,0,0,0.15) !important;
        }
        .chat-trigger-btn:active {
          transform: scale(0.95) ${isOpen ? 'rotate(90deg)' : ''} !important;
        }
      `}</style>

      {/* Chat Window */}
      {isOpen && (
        <div style={{
          position: 'fixed', bottom: '110px', right: '32px', zIndex: 9998,
          width: '400px', maxWidth: 'calc(100vw - 64px)',
          height: '600px', maxHeight: 'calc(100vh - 160px)',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(16px)',
          borderRadius: '24px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden', border: '1px solid rgba(229, 231, 235, 0.8)',
          animation: 'chat-appear 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}>
          {/* Header */}
          <div style={{
            background: '#ffffff',
            padding: '20px 24px', display: 'flex',
            alignItems: 'center', gap: '14px',
            borderBottom: '1px solid #f1f5f9'
          }}>
            <div style={{ position: 'relative' }}>
              <img 
                src={BOT_ICON} 
                alt="SevaBot" 
                style={{ width: '40px', height: '40px', borderRadius: '12px', border: '1px solid #f1f5f9' }} 
              />
              <div style={{
                position: 'absolute', bottom: '-2px', right: '-2px',
                width: '10px', height: '10px', background: '#10b981',
                borderRadius: '50%', border: '2px solid #fff'
              }} />
            </div>
            <div>
              <div style={{ fontWeight: '700', fontSize: '16px', color: '#0f172a', letterSpacing: '-0.01em' }}>SevaBot</div>
              <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Icons.Sparkles /> AI Assistant Active
              </div>
            </div>
          </div>

          {/* Messages Area */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '24px',
            display: 'flex', flexDirection: 'column', gap: '20px',
            scrollBehavior: 'smooth'
          }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                alignItems: 'flex-start', gap: '12px'
              }}>
                <div style={{ 
                  width: '32px', height: '32px', borderRadius: '10px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: msg.role === 'user' ? '#f1f5f9' : '#fff',
                  color: msg.role === 'user' ? '#64748b' : 'transparent',
                  border: msg.role === 'user' ? 'none' : '1px solid #f1f5f9',
                  flexShrink: 0
                }}>
                  {msg.role === 'user' ? <Icons.User /> : (
                    <img src={BOT_ICON} alt="B" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />
                  )}
                </div>
                <div style={{
                  background: msg.role === 'user' ? '#1e293b' : '#f8fafc',
                  color: msg.role === 'user' ? '#ffffff' : '#334155',
                  borderRadius: msg.role === 'user' ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
                  padding: '12px 16px', maxWidth: '85%',
                  fontSize: '14px', lineHeight: '1.6',
                  boxShadow: msg.role === 'user' ? 'none' : '0 2px 4px rgba(0,0,0,0.02)',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                }}>
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ 
                  width: '32px', height: '32px', borderRadius: '10px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: '#fff', border: '1px solid #f1f5f9'
                }}>
                  <img src={BOT_ICON} alt="B" style={{ width: '20px', height: '20px', borderRadius: '4px' }} />
                </div>
                <div style={{
                  background: '#f8fafc', borderRadius: '4px 18px 18px 18px',
                  padding: '12px 16px', fontSize: '13px', color: '#94a3b8',
                  fontStyle: 'italic'
                }}>
                  SevaBot is thinking...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick Suggestions (Premium Pill Style) */}
          {messages.length === 1 && (
            <div style={{ 
              display: 'flex', flexWrap: 'wrap', gap: '8px', 
              padding: '0 24px 20px 24px' 
            }}>
              {[
                'Reporting process',
                'Flood safety tips',
                'Regional updates',
                'How to volunteer'
              ].map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => sendMessage(suggestion)}
                  style={{
                    background: '#ffffff', border: '1px solid #e2e8f0',
                    color: '#475569', borderRadius: '10px',
                    padding: '8px 14px', fontSize: '13px',
                    cursor: 'pointer', transition: 'all 0.2s ease',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.03)'
                  }}
                  onMouseEnter={e => { e.target.style.borderColor = '#94a3b8'; e.target.style.background = '#f8fafc'; }}
                  onMouseLeave={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#ffffff'; }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {/* Input Bar */}
          <div style={{
            padding: '20px 24px 24px 24px', borderTop: '1px solid #f1f5f9',
            background: '#ffffff'
          }}>
            <div style={{
              display: 'flex', gap: '12px', alignItems: 'flex-end',
              background: '#f8fafc', borderRadius: '16px',
              padding: '8px 8px 8px 16px', border: '1px solid #f1f5f9',
              transition: 'border-color 0.2s ease'
            }}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Message SevaBot..."
                rows={1}
                style={{
                  flex: 1, resize: 'none', border: 'none',
                  background: 'transparent', padding: '10px 0',
                  fontSize: '14px', fontFamily: 'inherit',
                  outline: 'none', lineHeight: '1.5', color: '#1e293b'
                }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                style={{
                  background: '#1e293b', color: '#fff',
                  border: 'none', borderRadius: '12px',
                  width: '40px', height: '40px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'all 0.2s ease',
                  opacity: (loading || !input.trim()) ? 0.4 : 1
                }}
                aria-label="Send message"
              >
                <Icons.Send />
              </button>
            </div>
            <div style={{ 
              fontSize: '10px', color: '#94a3b8', textAlign: 'center', 
              marginTop: '12px', letterSpacing: '0.02em', textTransform: 'uppercase' 
            }}>
              Powered by SevaSetu Intelligence
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes chat-appear {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
}
