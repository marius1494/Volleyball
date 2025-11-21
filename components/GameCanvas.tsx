import React, { useRef, useEffect, useCallback } from 'react';
import { GameState, GameScore, Vector, Entity } from '../types';

interface GameCanvasProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  setScore: (score: GameScore) => void;
  onPointEnd: (winner: 'player' | 'cpu') => void;
}

// Physics Constants
const GRAVITY = 0.5;
const JUMP_FORCE = -12;
const MOVE_SPEED = 6;
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 400;
const NET_HEIGHT = 100;
const NET_X = CANVAS_WIDTH / 2;
const PLAYER_RADIUS = 40;
const BALL_RADIUS = 12;
const BOUNCE = 0.7;

const GameCanvas: React.FC<GameCanvasProps> = ({ gameState, setGameState, setScore, onPointEnd }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  
  // Game State Refs (Mutable for performance loop)
  const playerRef = useRef<Entity>({ pos: { x: 200, y: 400 }, vel: { x: 0, y: 0 }, radius: PLAYER_RADIUS, color: '#ef4444', onGround: true });
  const cpuRef = useRef<Entity>({ pos: { x: 600, y: 400 }, vel: { x: 0, y: 0 }, radius: PLAYER_RADIUS, color: '#3b82f6', onGround: true });
  const ballRef = useRef<Entity>({ pos: { x: 200, y: 200 }, vel: { x: 0, y: 0 }, radius: BALL_RADIUS, color: '#ffffff', onGround: false });
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const scoreRef = useRef<GameScore>({ player: 0, cpu: 0 });

  // Init / Reset
  const resetPositions = useCallback((server: 'player' | 'cpu') => {
    playerRef.current.pos = { x: 200, y: CANVAS_HEIGHT };
    playerRef.current.vel = { x: 0, y: 0 };
    playerRef.current.onGround = true;
    
    cpuRef.current.pos = { x: 600, y: CANVAS_HEIGHT };
    cpuRef.current.vel = { x: 0, y: 0 };
    cpuRef.current.onGround = true;

    // Serve toss: Start lower and toss up to give time to react
    ballRef.current.pos = server === 'player' ? { x: 200, y: 250 } : { x: 600, y: 250 };
    ballRef.current.vel = { x: 0, y: -9 };
  }, []);

  // Input handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { keysRef.current[e.code] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keysRef.current[e.code] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Helper: Circle vs Circle Collision
  const checkCircleCollision = (c1: Entity, c2: Entity) => {
    const dx = c1.pos.x - c2.pos.x;
    const dy = c1.pos.y - c2.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Slime collision (Player is a semicircle effectively for physics here)
    // We cheat a bit: If ball hits player, we treat player as a solid circle
    if (dist < c1.radius + c2.radius) {
      // Normalize impact vector
      const nx = dx / dist;
      const ny = dy / dist;

      // Relative velocity
      // We want to add some "pop" to the ball based on player movement
      const speed = Math.sqrt(c2.vel.x * c2.vel.x + c2.vel.y * c2.vel.y);
      const force = Math.max(14, speed * 1.1); // Minimum bounce force increased

      // Apply reflection to ball
      c2.vel.x = -nx * force + c1.vel.x * 0.5; // Add player velocity influence
      c2.vel.y = -ny * force + c1.vel.y * 0.5 - 4; // Add stronger upward kick
      
      // Push ball out of player to prevent sticking
      const overlap = (c1.radius + c2.radius) - dist;
      c2.pos.x -= nx * overlap;
      c2.pos.y -= ny * overlap;
    }
  };

  // Game Loop
  const update = useCallback(() => {
    if (gameState !== GameState.PLAYING) return;

    const player = playerRef.current;
    const cpu = cpuRef.current;
    const ball = ballRef.current;

    // --- PLAYER MOVEMENT ---
    if (keysRef.current['ArrowLeft'] || keysRef.current['KeyA']) player.vel.x = -MOVE_SPEED;
    else if (keysRef.current['ArrowRight'] || keysRef.current['KeyD']) player.vel.x = MOVE_SPEED;
    else player.vel.x = 0;

    if ((keysRef.current['ArrowUp'] || keysRef.current['KeyW']) && player.onGround) {
      player.vel.y = JUMP_FORCE;
      player.onGround = false;
    }

    // --- CPU AI ---
    const cpuX = cpu.pos.x;
    const ballX = ball.pos.x;
    
    // Default home position (defending center-back of right court)
    let targetX = 650; 

    // If ball is approaching or on CPU side
    if (ballX > NET_X - 50) {
        // CPU tries to get slightly BEHIND the ball (to the right)
        // This ensures the hit directs the ball towards the net (left)
        targetX = ballX + 20;
    }
    
    // Move towards target
    const diff = targetX - cpuX;
    if (Math.abs(diff) > 5) {
        cpu.vel.x = diff > 0 ? MOVE_SPEED * 0.85 : -MOVE_SPEED * 0.85;
    } else {
        cpu.vel.x = 0;
    }

    // Jump Logic
    if (
        ballX > NET_X &&                 // Ball is on CPU side
        Math.abs(ballX - cpuX) < 50 &&   // Ball is close horizontally
        ball.pos.y > 200 &&              // Ball has dropped enough
        ball.pos.y < 350 &&              // Not too low to the ground
        cpu.onGround                     // Can jump
    ) {
        cpu.vel.y = JUMP_FORCE;
        cpu.onGround = false;
    }


    // --- PHYSICS UPDATE ---
    [player, cpu].forEach(p => {
      p.vel.y += GRAVITY;
      p.pos.x += p.vel.x;
      p.pos.y += p.vel.y;

      // Floor collision
      if (p.pos.y > CANVAS_HEIGHT) {
        p.pos.y = CANVAS_HEIGHT;
        p.vel.y = 0;
        p.onGround = true;
      }

      // Wall collision
      if (p.pos.x < p.radius) p.pos.x = p.radius;
      if (p.pos.x > CANVAS_WIDTH - p.radius) p.pos.x = CANVAS_WIDTH - p.radius;

      // Net Collision (Player)
      // Net is at NET_X, extends up to CANVAS_HEIGHT - NET_HEIGHT
      // Treat Net as a wall for players
      const netTop = CANVAS_HEIGHT - NET_HEIGHT;
      if (p === player && p.pos.x > NET_X - p.radius) p.pos.x = NET_X - p.radius;
      if (p === cpu && p.pos.x < NET_X + p.radius) p.pos.x = NET_X + p.radius;
    });

    // --- BALL PHYSICS ---
    ball.vel.y += GRAVITY * 0.8; // slightly floatier ball
    // Air resistance
    ball.vel.x *= 0.995; 
    ball.vel.y *= 0.995;

    ball.pos.x += ball.vel.x;
    ball.pos.y += ball.vel.y;

    // Wall Bounce
    if (ball.pos.x < ball.radius) {
      ball.pos.x = ball.radius;
      ball.vel.x *= -BOUNCE;
    }
    if (ball.pos.x > CANVAS_WIDTH - ball.radius) {
      ball.pos.x = CANVAS_WIDTH - ball.radius;
      ball.vel.x *= -BOUNCE;
    }
    // Ceiling Bounce
    if (ball.pos.y < ball.radius) {
        ball.pos.y = ball.radius;
        ball.vel.y *= -BOUNCE;
    }

    // Net Collision (Ball)
    // Net is a thin line for simplicity, or a thin rect
    const netTop = CANVAS_HEIGHT - NET_HEIGHT;
    
    // Check hitting top of net (circle collision)
    const distToNetTop = Math.sqrt(Math.pow(ball.pos.x - NET_X, 2) + Math.pow(ball.pos.y - netTop, 2));
    if (distToNetTop < ball.radius + 5) { // 5 is net post radius
        // Reflect
        const dx = ball.pos.x - NET_X;
        const dy = ball.pos.y - netTop;
        const len = Math.sqrt(dx*dx + dy*dy);
        const nx = dx/len;
        const ny = dy/len;
        
        const dot = ball.vel.x * nx + ball.vel.y * ny;
        ball.vel.x = (ball.vel.x - 2 * dot * nx) * BOUNCE;
        ball.vel.y = (ball.vel.y - 2 * dot * ny) * BOUNCE;
        
        // Push out
        const pen = (ball.radius + 5) - distToNetTop;
        ball.pos.x += nx * pen;
        ball.pos.y += ny * pen;
    }
    // Check hitting side of net
    else if (ball.pos.y > netTop) {
        if (Math.abs(ball.pos.x - NET_X) < ball.radius + 5) {
             // Hit side
             ball.vel.x *= -BOUNCE;
             if (ball.pos.x < NET_X) ball.pos.x = NET_X - ball.radius - 5;
             else ball.pos.x = NET_X + ball.radius + 5;
        }
    }

    // Player - Ball Collision
    checkCircleCollision(player, ball);
    checkCircleCollision(cpu, ball);

    // --- SCORING ---
    // Ball hits ground
    if (ball.pos.y >= CANVAS_HEIGHT - ball.radius) {
      // Check side
      if (ball.pos.x < NET_X) {
        // Hit Player side -> CPU scores
        scoreRef.current.cpu += 1;
        setScore({ ...scoreRef.current });
        onPointEnd('cpu');
        resetPositions('player'); // Winner serves
      } else {
        // Hit CPU side -> Player scores
        scoreRef.current.player += 1;
        setScore({ ...scoreRef.current });
        onPointEnd('player');
        resetPositions('cpu');
      }
      
      setGameState(GameState.POINT_SCORED);
    }

  }, [gameState, onPointEnd, resetPositions, setGameState, setScore]);

  // Render Loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw Sky (Gradient)
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#7dd3fc'); // sky-300
    gradient.addColorStop(1, '#bae6fd'); // sky-200
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw Sand
    ctx.fillStyle = '#fde047'; // yellow-300
    ctx.fillRect(0, CANVAS_HEIGHT - 10, CANVAS_WIDTH, 10);

    // Draw Net
    ctx.fillStyle = '#475569'; // slate-600
    ctx.fillRect(NET_X - 2, CANVAS_HEIGHT - NET_HEIGHT, 4, NET_HEIGHT);
    
    // --- DRAW BROCCOLI ---
    const drawBroccoli = (e: Entity) => {
      ctx.save();
      // Move to center of entity (which sits on ground)
      ctx.translate(e.pos.x, e.pos.y);

      // Direction they are facing (look at net)
      const facingRight = e.pos.x < NET_X;
      
      // 1. The Stalk (Strunk) - Light Green
      ctx.fillStyle = '#a3e635'; // lime-400
      ctx.beginPath();
      // Draw a tapered stalk
      ctx.moveTo(-15, 0); // Bottom left
      ctx.lineTo(15, 0);  // Bottom right
      ctx.lineTo(10, -40); // Top right (neck)
      ctx.lineTo(-10, -40); // Top left (neck)
      ctx.fill();
      
      // 2. The Head (Florets) - Dark Green
      ctx.fillStyle = '#15803d'; // green-700
      
      // Draw multiple circles to form the bushy head
      const drawFloret = (ox: number, oy: number, r: number) => {
        ctx.beginPath();
        ctx.arc(ox, oy, r, 0, Math.PI * 2);
        ctx.fill();
      };

      drawFloret(0, -50, 25);   // Top center
      drawFloret(-20, -40, 20); // Left
      drawFloret(20, -40, 20);  // Right
      drawFloret(-15, -25, 15); // Bottom Left fill
      drawFloret(15, -25, 15);  // Bottom Right fill

      // 3. Headband (Team Color)
      ctx.fillStyle = e.color;
      ctx.fillRect(-22, -55, 44, 8); // Sweatband across forehead area

      // 4. Face
      // Eyes
      const eyeXOffset = facingRight ? 8 : -8;
      
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(-5 + eyeXOffset, -35, 6, 0, Math.PI * 2); // Left eye
      ctx.arc(5 + eyeXOffset, -35, 6, 0, Math.PI * 2);  // Right eye
      ctx.fill();

      // Pupils
      ctx.fillStyle = 'black';
      ctx.beginPath();
      ctx.arc(-5 + eyeXOffset + (facingRight?1:-1), -35, 2, 0, Math.PI * 2);
      ctx.arc(5 + eyeXOffset + (facingRight?1:-1), -35, 2, 0, Math.PI * 2);
      ctx.fill();

      // Smile
      ctx.beginPath();
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 2;
      ctx.arc(0 + eyeXOffset, -28, 5, 0.2, Math.PI - 0.2);
      ctx.stroke();

      ctx.restore();
    };

    // Draw Ball
    const drawBall = (e: Entity) => {
        ctx.beginPath();
        ctx.arc(e.pos.x, e.pos.y, e.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'white';
        ctx.fill();
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.closePath();
    }

    drawBroccoli(playerRef.current);
    drawBroccoli(cpuRef.current);
    drawBall(ballRef.current);

  }, []);

  useEffect(() => {
    const loop = (time: number) => {
      update();
      draw();
      requestRef.current = requestAnimationFrame(loop);
    };
    requestRef.current = requestAnimationFrame(loop);
    return () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [update, draw]);

  // Init reset
  useEffect(() => {
      resetPositions('player');
  }, [resetPositions]);

  return (
    <div className="relative rounded-xl overflow-hidden shadow-2xl border-4 border-yellow-400 bg-sky-200">
        <canvas 
            ref={canvasRef} 
            width={CANVAS_WIDTH} 
            height={CANVAS_HEIGHT}
            className="block w-full max-w-[800px] h-auto"
        />
        
        {/* Instructions Overlay */}
        {gameState === GameState.MENU && (
            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white backdrop-blur-sm">
                <h1 className="text-5xl font-bold mb-4 drop-shadow-md text-yellow-300">Sunny Volley</h1>
                <p className="mb-8 text-lg opacity-90">Benutze WASD oder Pfeiltasten zum Bewegen und Springen.</p>
                <button 
                    onClick={() => setGameState(GameState.PLAYING)}
                    className="px-8 py-3 bg-green-500 hover:bg-green-600 text-white rounded-full font-bold text-xl transition-transform transform hover:scale-105 shadow-lg"
                >
                    Spiel Starten
                </button>
            </div>
        )}

        {/* Point Scored Overlay */}
        {gameState === GameState.POINT_SCORED && (
             <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <h2 className="text-6xl font-bold text-white drop-shadow-[0_5px_5px_rgba(0,0,0,0.5)] animate-float">
                    PUNKT!
                </h2>
             </div>
        )}
    </div>
  );
};

export default GameCanvas;