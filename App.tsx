import React, { useState, useEffect } from 'react';
import GameCanvas from './components/GameCanvas';
import { GameState, GameScore, CommentaryResponse } from './types';
import { generateCommentary } from './services/geminiService';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [score, setScore] = useState<GameScore>({ player: 0, cpu: 0 });
  const [commentary, setCommentary] = useState<CommentaryResponse>({ text: "Willkommen am Strand! Wer holt sich den Sieg?", mood: 'excited' });
  const [isCommentating, setIsCommentating] = useState(false);

  // Handle round reset delay
  useEffect(() => {
    if (gameState === GameState.POINT_SCORED) {
      const timer = setTimeout(() => {
        setGameState(GameState.PLAYING);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [gameState]);

  const handlePointEnd = async (winner: 'player' | 'cpu') => {
    const eventDescription = winner === 'player' ? "Mr. B erzielt einen Punkt mit einem Smash!" : "Sören sein Vater überlistet Mr. B!";
    
    // Fetch AI Commentary
    setIsCommentating(true);
    try {
      // Small delay to not freeze frame immediately
      const result = await generateCommentary(score.player + (winner === 'player' ? 1 : 0), score.cpu + (winner === 'cpu' ? 1 : 0), eventDescription);
      setCommentary(result);
    } catch (e) {
      console.error(e);
    } finally {
      setIsCommentating(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4">
      <header className="mb-4 text-center">
        <h1 className="text-4xl font-bold text-sky-600 drop-shadow-sm mb-2">🏖️ Sunny Broccoli Volley</h1>
        <p className="text-sky-800">Das gesündeste Sportspiel aller Zeiten!</p>
      </header>

      {/* Scoreboard - High Visibility */}
      <div className="flex justify-between w-full max-w-[800px] mb-4 px-2">
        <div className="flex flex-col items-center">
          <div className="bg-red-500 text-white px-6 py-2 rounded-xl border-b-4 border-red-700 shadow-lg min-w-[140px] text-center">
             <span className="block text-xs uppercase tracking-wider opacity-80 mb-1 font-bold">Mr. B</span>
             <span className="text-4xl font-black">{score.player}</span>
          </div>
        </div>
        
        <div className="flex flex-col items-center">
          <div className="bg-blue-500 text-white px-6 py-2 rounded-xl border-b-4 border-blue-700 shadow-lg min-w-[140px] text-center">
             <span className="block text-xs uppercase tracking-wider opacity-80 mb-1 font-bold">Sören sein Vater</span>
             <span className="text-4xl font-black">{score.cpu}</span>
          </div>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="relative group">
        <GameCanvas 
          gameState={gameState}
          setGameState={setGameState}
          setScore={setScore}
          onPointEnd={handlePointEnd}
        />
      </div>

      {/* Commentary Section */}
      <div className={`mt-8 max-w-2xl w-full p-6 rounded-2xl shadow-lg transition-colors duration-500 border-l-8 
        ${commentary.mood === 'excited' ? 'bg-orange-50 border-orange-500' : 
          commentary.mood === 'sarcastic' ? 'bg-purple-50 border-purple-500' : 
          commentary.mood === 'encouraging' ? 'bg-green-50 border-green-500' : 'bg-white border-gray-400'}`}>
        
        <div className="flex items-start gap-4">
          <div className="bg-gray-200 rounded-full p-3 shrink-0">
            <span className="text-2xl">🎙️</span>
          </div>
          <div>
            <h3 className="font-bold text-gray-500 text-sm uppercase tracking-wider mb-1">Kommentator Box {isCommentating && <span className="animate-pulse text-red-500 ml-2">● LIVE</span>}</h3>
            <p className="text-xl font-medium text-gray-800 italic">
              "{commentary.text}"
            </p>
          </div>
        </div>
      </div>

      {/* Controls Hint */}
      <div className="mt-8 grid grid-cols-2 gap-8 text-slate-600 text-sm bg-white/50 p-4 rounded-lg">
        <div className="text-center">
          <div className="font-bold mb-1">Bewegen</div>
          <div className="flex gap-1 justify-center">
            <kbd className="px-2 py-1 bg-white border rounded shadow">A</kbd>
            <kbd className="px-2 py-1 bg-white border rounded shadow">D</kbd>
          </div>
        </div>
        <div className="text-center">
          <div className="font-bold mb-1">Springen</div>
          <kbd className="px-2 py-1 bg-white border rounded shadow w-12 inline-block">W</kbd>
        </div>
      </div>

      <footer className="mt-12 text-slate-400 text-xs">
        Powered by React, Canvas & Google Gemini
      </footer>
    </div>
  );
};

export default App;