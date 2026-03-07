import React, { useState, useRef, useEffect } from 'react';
import { useStorefront } from '../context/StorefrontContext';
import { Flame, CheckCircle, AlertCircle, ShieldCheck, Lock, Ticket, Gift, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const StorefrontRewards = () => {
  const { user, settings, verifyStaffPin, brandName } = useStorefront();
  const navigate = useNavigate();
  const config = settings.rewards || { enabled: false, maxStamps: 10, programName: '', rewardTitle: '', staffPin: '1234', rewardImage: '', possiblePrizes: [] };

  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinAction, setPinAction] = useState('ADD');
  const [enteredPin, setEnteredPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isScratched, setIsScratched] = useState(false);
  const [isScratching, setIsScratching] = useState(false);
  const canvasRef = useRef(null);
  const [wonPrize, setWonPrize] = useState(null);
  const [shufflingIndex, setShufflingIndex] = useState(0);
  const [isShuffling, setIsShuffling] = useState(false);

  const currentStamps = user?.stamps || 0;
  const maxStamps = config.maxStamps || 10;
  const isFull = currentStamps >= maxStamps;

  const prizes = config.possiblePrizes?.length > 0
    ? config.possiblePrizes
    : [{ id: 'default', title: config.rewardTitle || 'Mystery Prize', image: config.rewardImage }];

  useEffect(() => {
    if (isFull && !isScratched && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const parent = canvas.parentElement;
        if (parent) { canvas.width = parent.offsetWidth; canvas.height = parent.offsetHeight; }
        ctx.fillStyle = '#C08F29';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < 500; i++) {
          ctx.fillStyle = Math.random() > 0.5 ? '#FCD34D' : '#78350F';
          ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 2, 2);
        }
        ctx.fillStyle = '#000';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SCRATCH TO REVEAL', canvas.width / 2, canvas.height / 2 + 8);
        ctx.globalCompositeOperation = 'destination-out';
      }
    }
  }, [isFull, isScratched]);

  const handleMouseMove = (e) => {
    if (!isScratching || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    ctx.beginPath();
    ctx.arc(clientX - rect.left, clientY - rect.top, 30, 0, Math.PI * 2);
    ctx.fill();
  };

  const finishScratch = () => {
    setIsScratching(false);
    if (!isScratched) {
      setTimeout(() => { setIsScratched(true); startShuffle(); }, 300);
    }
  };

  const startShuffle = () => {
    setIsShuffling(true);
    let count = 0;
    const interval = setInterval(() => {
      setShufflingIndex(prev => (prev + 1) % prizes.length);
      count++;
      if (count > 20) {
        clearInterval(interval);
        const winnerIndex = Math.floor(Math.random() * prizes.length);
        setShufflingIndex(winnerIndex);
        setWonPrize(prizes[winnerIndex]);
        setIsShuffling(false);
      }
    }, 100);
  };

  const handlePinSubmit = () => {
    const success = verifyStaffPin(enteredPin, pinAction);
    if (success) {
      setSuccessMsg(pinAction === 'ADD' ? 'STAMP ADDED!' : 'REWARD REDEEMED!');
      setTimeout(() => {
        setIsPinModalOpen(false);
        setSuccessMsg('');
        setEnteredPin('');
        if (pinAction === 'REDEEM') { setIsScratched(false); setWonPrize(null); }
      }, 1500);
    } else {
      setErrorMsg('INCORRECT PIN');
      setEnteredPin('');
    }
  };

  const handleKeyPad = (num) => { if (enteredPin.length < 4) setEnteredPin(prev => prev + num); };

  const openModal = (action) => {
    setPinAction(action);
    setIsPinModalOpen(true);
    setEnteredPin('');
    setErrorMsg('');
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 animate-fade-in">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-bbq-gold blur-2xl opacity-20 rounded-full animate-pulse"></div>
          <Ticket size={80} className="text-bbq-gold relative z-10" strokeWidth={1} />
        </div>
        <h2 className="text-4xl font-display font-bold text-white mb-2 tracking-wide uppercase">Golden Ticket Club</h2>
        <p className="text-gray-400 mb-8 max-w-xs mx-auto text-lg">Earn stamps. Reveal prizes.<br/>Join the inner circle.</p>
        <button onClick={() => navigate('/login')}
          className="bg-gradient-to-r from-bbq-gold to-yellow-600 text-black px-10 py-4 rounded-full font-black uppercase tracking-widest hover:scale-105 transition shadow-[0_0_30px_rgba(251,191,36,0.3)]">
          Get Your Ticket
        </button>
      </div>
    );
  }

  if (!config.enabled) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
        <AlertCircle size={48} className="text-gray-600 mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Program Paused</h2>
        <p className="text-gray-500">The rewards program is currently unavailable.</p>
      </div>
    );
  }

  const tickerPrizes = [...prizes, ...prizes, ...prizes];

  return (
    <div className="max-w-4xl mx-auto pb-20 animate-fade-in overflow-hidden">
      <div className="text-center mb-10 relative">
        <h1 className="text-5xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-b from-bbq-gold to-yellow-700 uppercase tracking-tight mb-2">
          {config.programName || 'The Golden Ticket'}
        </h1>
        <p className="text-gray-400 text-sm font-mono tracking-widest uppercase">
          Member: {user.name} // Status: {isFull ? 'ELIGIBLE' : 'COLLECTING'}
        </p>
      </div>

      {/* GOLDEN TICKET */}
      <div className="relative w-full max-w-2xl mx-auto mb-12 px-4">
        <div className={`relative w-full transition-shadow duration-700 ${isFull ? 'shadow-[0_0_50px_rgba(251,191,36,0.3)]' : 'shadow-2xl'}`} style={{ aspectRatio: '2/1' }}>
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-200 via-yellow-500 to-yellow-700 rounded-3xl overflow-hidden border-4 border-yellow-300">
            <div className="absolute inset-0 p-6 md:p-8 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div className="bg-black/80 text-bbq-gold px-4 py-1 rounded border border-bbq-gold font-bold text-xs uppercase tracking-widest">
                  Admit One
                </div>
                <div className="text-black font-black text-xl font-display tracking-tighter opacity-80">{brandName?.toUpperCase()}</div>
              </div>
              <div className="flex-1 flex items-center justify-center relative">
                {isFull ? (
                  <div className="w-full h-full bg-white/20 rounded-xl border-2 border-black/10 overflow-hidden relative">
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black p-4 text-center">
                      {prizes.length > 0 && (
                        <div className="flex flex-col items-center justify-center h-full w-full">
                          <div className={`transition-all duration-100 ${isShuffling ? 'blur-sm scale-95' : 'scale-100'}`}>
                            {prizes[shufflingIndex]?.image && (
                              <img src={prizes[shufflingIndex].image} className="w-16 h-16 md:w-20 md:h-20 object-cover rounded-full border-2 border-bbq-gold mb-2 mx-auto" alt="Prize" />
                            )}
                            <h3 className="text-bbq-gold font-bold text-xl md:text-2xl uppercase leading-none">{prizes[shufflingIndex]?.title}</h3>
                          </div>
                          {wonPrize && !isShuffling && <p className="text-green-400 font-bold text-xs mt-2 animate-bounce bg-green-900/50 px-3 py-1 rounded-full uppercase tracking-wider">Winner!</p>}
                          {isShuffling && <p className="text-gray-500 font-mono text-xs mt-2 animate-pulse">CYCLING PRIZES...</p>}
                        </div>
                      )}
                    </div>
                    {!isScratched && (
                      <canvas ref={canvasRef} className="absolute inset-0 cursor-crosshair touch-none"
                        onMouseDown={() => setIsScratching(true)} onTouchStart={() => setIsScratching(true)}
                        onMouseUp={finishScratch} onTouchEnd={finishScratch}
                        onMouseMove={handleMouseMove} onTouchMove={handleMouseMove} />
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-5 gap-3 w-full max-w-md">
                    {Array.from({ length: maxStamps }).map((_, i) => {
                      const filled = i < currentStamps;
                      return (
                        <div key={i} className="aspect-square relative flex items-center justify-center">
                          <div className="absolute inset-0 border-2 border-black/20 rounded-full"></div>
                          {filled && (
                            <div className="absolute inset-0 bg-black rounded-full flex items-center justify-center shadow-lg" style={{ transform: 'rotate(-12deg)' }}>
                              <Flame className="text-bbq-gold" size={18} fill="currentColor" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="mt-4 flex justify-between items-end">
                <div className="text-black/60 font-mono text-xs font-bold">NO: {(user._id || user.id || '').slice(0, 8).toUpperCase()}</div>
                <div className="text-black font-black text-4xl font-display leading-none">{currentStamps} <span className="text-lg opacity-50">/ {maxStamps}</span></div>
              </div>
            </div>
          </div>
          <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-12 bg-bbq-charcoal rounded-r-full border-r border-gray-700"></div>
          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-8 h-12 bg-bbq-charcoal rounded-l-full border-l border-gray-700"></div>
        </div>
      </div>

      {/* POSSIBLE PRIZES TICKER */}
      {!isFull && prizes.length > 0 && (
        <div className="mb-12 max-w-3xl mx-auto px-4">
          <div className="relative mb-6 rounded-xl overflow-hidden border border-bbq-gold/30 shadow-[0_0_20px_rgba(251,191,36,0.1)]">
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-900/40 via-black to-yellow-900/40"></div>
            <div className="relative z-10 py-3 text-center">
              <h4 className="text-white font-bold uppercase tracking-widest text-sm flex items-center justify-center gap-2">
                <Trophy size={16} className="text-bbq-gold"/> Guaranteed Winner Upon Completion <Trophy size={16} className="text-bbq-gold"/>
              </h4>
            </div>
          </div>
          <div className="relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-bbq-charcoal to-transparent z-10"></div>
            <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-bbq-charcoal to-transparent z-10"></div>
            <div className="flex animate-marquee w-fit">
              {tickerPrizes.map((prize, idx) => (
                <div key={idx} className="flex-shrink-0 w-44 px-2">
                  <div className="bg-gray-900 border border-gray-800 p-3 rounded-xl flex flex-col items-center gap-2 hover:border-bbq-gold/50 transition">
                    <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-gray-700 shadow-lg">
                      <img src={prize.image || 'https://placehold.co/100'} className="w-full h-full object-cover" alt={prize.title} />
                    </div>
                    <span className="text-xs font-bold text-gray-300 leading-tight text-center block">{prize.title}</span>
                    <span className="text-[10px] text-gray-600 uppercase tracking-wide">Possible Prize</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ACTION BUTTONS */}
      <div className="flex justify-center gap-4 px-4">
        {isFull ? (
          isScratched && wonPrize && !isShuffling ? (
            <button onClick={() => openModal('REDEEM')}
              className="bg-green-600 text-white px-12 py-4 rounded-full font-bold uppercase tracking-widest text-lg hover:bg-green-500 transition shadow-[0_0_30px_rgba(34,197,94,0.4)] flex items-center gap-3 animate-pulse">
              <Trophy size={24} /> Redeem Prize
            </button>
          ) : (
            <div className="text-gray-400 text-sm animate-pulse flex items-center gap-2 bg-black/40 px-4 py-2 rounded-full border border-gray-700">
              <Gift className="text-bbq-gold"/>
              {isScratched ? 'Finding your prize...' : 'Scratch the gold area above to reveal!'}
            </div>
          )
        ) : (
          <button onClick={() => openModal('ADD')}
            className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white px-8 py-4 rounded-xl font-bold flex items-center gap-3 transition group">
            <div className="bg-white text-black p-2 rounded-lg group-hover:rotate-12 transition"><ShieldCheck size={20}/></div>
            <span>Staff Check-in (Add Stamp)</span>
          </button>
        )}
      </div>

      {/* STAFF PIN MODAL */}
      {isPinModalOpen && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4" style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm bg-bbq-charcoal border border-gray-700 rounded-3xl overflow-hidden shadow-2xl" style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <div className="p-8 text-center">
              {successMsg ? (
                <div className="py-10">
                  <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_#22c55e]">
                    <CheckCircle size={40} className="text-white" />
                  </div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-wider">{successMsg}</h3>
                </div>
              ) : (
                <>
                  <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-widest flex items-center justify-center gap-2">
                    <Lock size={16} className="text-bbq-red"/> Staff Authorization
                  </h3>
                  {pinAction === 'REDEEM' && wonPrize && (
                    <div className="bg-black/40 p-3 rounded mb-4 border border-gray-700">
                      <p className="text-xs text-gray-400 uppercase">Customer Is Claiming</p>
                      <p className="text-lg font-bold text-bbq-gold">{wonPrize.title}</p>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mb-8">Enter 4-digit PIN to {pinAction.toLowerCase()}.</p>
                  <div className="flex justify-center gap-4 mb-8">
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} className={`w-3 h-3 rounded-full transition-all duration-200 ${enteredPin.length > i ? 'bg-bbq-red scale-125' : 'bg-gray-800'}`}></div>
                    ))}
                  </div>
                  {errorMsg && <div className="text-red-500 text-xs font-bold mb-6 bg-red-900/20 py-2 rounded">{errorMsg}</div>}
                  <div className="grid grid-cols-3 gap-4 mb-8">
                    {[1,2,3,4,5,6,7,8,9].map(num => (
                      <button key={num} onClick={() => handleKeyPad(num.toString())}
                        className="h-16 rounded-2xl bg-black hover:bg-gray-900 text-white font-bold text-xl transition active:scale-95 border border-gray-800">{num}</button>
                    ))}
                    <button onClick={() => setEnteredPin('')}
                      className="h-16 rounded-2xl bg-black hover:bg-red-900/30 text-red-400 font-bold text-sm transition border border-gray-800">CLR</button>
                    <button onClick={() => handleKeyPad('0')}
                      className="h-16 rounded-2xl bg-black hover:bg-gray-900 text-white font-bold text-xl transition active:scale-95 border border-gray-800">0</button>
                    <button onClick={handlePinSubmit}
                      className="h-16 rounded-2xl bg-white hover:bg-gray-200 text-black font-black text-sm transition">GO</button>
                  </div>
                  <button onClick={() => setIsPinModalOpen(false)} className="text-gray-500 text-xs hover:text-white uppercase tracking-widest">Cancel Transaction</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StorefrontRewards;
