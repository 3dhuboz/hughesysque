
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Bot, User, Flame, Send, Loader2 } from 'lucide-react';
import { askPitmasterAI, PitmasterContext } from '../services/gemini';
import { useApp } from '../context/AppContext';
import { toLocalDateStr } from '../utils/dateUtils';

interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

const SUGGESTED = [
  'How do I stop my brisket drying out?',
  'What temp should I pull my pork shoulder at?',
  "Can you do catering for 80 at a wedding — what's the process?",
  "What's your SPG rub ratio?",
  'Why did my ribs come out tough?',
];

const PitmasterChat: React.FC = () => {
  const { settings, calendarEvents, menu } = useApp();
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
      { role: 'model', text: "G'day! It's Macca here (digital version). I've got the smoker rolling on Ironbark. Ask me anything — BBQ technique, temps and times, rub ratios, catering, equipment, or troubleshooting a cook that's gone sideways." }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Keep the chat pinned to the latest reply
  useEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [chatHistory, isTyping]);

  // Build a fresh context snapshot every send so Macca knows what's on right now
  const context = useMemo<PitmasterContext>(() => {
    const todayStr = toLocalDateStr(new Date());
    const upcomingCookDays = (calendarEvents || [])
      .filter(e => (e.type === 'ORDER_PICKUP' || e.type === 'PUBLIC_EVENT') && e.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 6)
      .map(e => ({ date: e.date, title: e.title, location: e.location, time: e.time }));

    const cateringItems = (menu || []).filter((m: any) => m.availableForCatering || m.isCatering);
    const availableMeats = Array.from(new Set(cateringItems.filter((m: any) => ['Meats', 'Bulk Meats', 'Trays', 'Platters'].includes(m.category)).map((m: any) => m.name))).slice(0, 20);
    const availableSides = Array.from(new Set(cateringItems.filter((m: any) => ['Hot Sides', 'Cold Sides', 'Sides', 'Salads'].includes(m.category)).map((m: any) => m.name))).slice(0, 20);

    const cateringPackages = settings?.cateringPackages || [];
    const cateringMinPax = cateringPackages.length > 0
      ? Math.min(...cateringPackages.map((p: any) => p.minPax || 10))
      : undefined;

    return {
      upcomingCookDays,
      availableMeats,
      availableSides,
      cateringMinPax,
      contactPhone: settings?.phone,
      contactEmail: settings?.contactEmail || settings?.adminEmail,
    };
  }, [calendarEvents, menu, settings]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const userMsg: ChatMessage = { role: 'user', text: trimmed };
    setChatHistory(prev => [...prev, userMsg]);
    setChatInput('');
    setIsTyping(true);

    const responseText = await askPitmasterAI(
      chatHistory.concat(userMsg).map(m => ({ role: m.role, text: m.text })),
      userMsg.text,
      context,
    );

    setChatHistory(prev => [...prev, { role: 'model', text: responseText }]);
    setIsTyping(false);
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await send(chatInput);
  };

  return (
    <div className="h-[600px] flex flex-col bg-gray-900 border border-gray-700 rounded-xl overflow-hidden shadow-2xl">
        <div className="bg-gray-800 p-4 border-b border-gray-700 flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-bbq-red to-red-900 rounded-full flex items-center justify-center shadow-lg border border-red-500/30">
                <Bot className="text-white" size={24} />
            </div>
            <div>
                <h3 className="font-bold text-white text-lg leading-none">Pitmaster Macca (AI)</h3>
                <p className="text-xs text-bbq-gold font-mono uppercase tracking-widest mt-1">Powered by Ironbark & Macca's Brain</p>
            </div>
        </div>
        
        <div ref={scrollerRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-black/20 custom-scrollbar">
            {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl p-4 shadow-md ${msg.role === 'user' ? 'bg-bbq-red text-white rounded-tr-none' : 'bg-gray-800 text-gray-200 border border-gray-700 rounded-tl-none'}`}>
                        <div className="flex items-center gap-2 mb-2 opacity-50 text-[10px] uppercase font-bold tracking-widest">
                            {msg.role === 'user' ? <User size={10}/> : <Flame size={10}/>}
                            {msg.role === 'user' ? 'You' : 'Macca'}
                        </div>
                        <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</div>
                    </div>
                </div>
            ))}
            {isTyping && (
                <div className="flex justify-start">
                    <div className="bg-gray-800 text-gray-400 text-xs p-3 rounded-xl border border-gray-700 italic flex items-center gap-2">
                        <Loader2 className="animate-spin" size={12}/> Macca's thinking…
                    </div>
                </div>
            )}
            {chatHistory.length === 1 && !isTyping && (
              <div className="pt-2">
                <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-2 font-bold">Try one of these</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED.map(s => (
                    <button key={s} type="button" onClick={() => send(s)}
                      className="text-left text-xs text-gray-300 bg-gray-900/60 border border-gray-800 hover:border-bbq-gold/60 hover:text-white rounded-full px-3 py-1.5 transition">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
        </div>

        <form onSubmit={handleChatSubmit} className="p-4 bg-gray-800 border-t border-gray-700 flex gap-2">
            <input 
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Ask Macca about brisket temps, resting times, or wood types..."
                className="flex-1 bg-gray-900 border border-gray-600 rounded-xl p-4 text-white focus:border-bbq-red outline-none transition placeholder:text-gray-600"
            />
            <button 
                type="submit" 
                disabled={!chatInput.trim() || isTyping}
                className="bg-bbq-gold text-black p-4 rounded-xl font-bold hover:bg-yellow-500 disabled:opacity-50 transition shadow-lg"
            >
                <Send size={20} />
            </button>
        </form>
    </div>
  );
};

export default PitmasterChat;
