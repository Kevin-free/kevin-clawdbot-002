'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

// Game constants
const GAME_WIDTH = 400;
const GAME_HEIGHT = 600;
const GRAVITY = 0.4;
const JUMP_STRENGTH = -8;
const BULLET_SPEED = 8;
const PIPE_SPEED = 2;
const PIPE_SPAWN_RATE = 150;

interface Pipe {
  x: number;
  topHeight: number;
  gap: number;
  passed: boolean;
}

interface Bullet {
  x: number;
  y: number;
  active: boolean;
}

interface Player {
  x: number;
  y: number;
  velocity: number;
  rotation: number;
}

export default function FlyingGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [gameState, setGameState] = useState<'start' | 'playing' | 'gameOver'>('start');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  
  const playerRef = useRef<Player>({ x: 80, y: 250, velocity: 0, rotation: 0 });
  const pipesRef = useRef<Pipe[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const frameCountRef = useRef(0);

  const resetGame = useCallback(() => {
    playerRef.current = { x: 80, y: 250, velocity: 0, rotation: 0 };
    pipesRef.current = [];
    bulletsRef.current = [];
    frameCountRef.current = 0;
    setScore(0);
  }, []);

  const jump = useCallback(() => {
    if (gameState === 'start') {
      setGameState('playing');
      playerRef.current.velocity = JUMP_STRENGTH;
    } else if (gameState === 'playing') {
      playerRef.current.velocity = JUMP_STRENGTH;
    } else if (gameState === 'gameOver') {
      resetGame();
      setGameState('start');
    }
  }, [gameState, resetGame]);

  const shoot = useCallback(() => {
    if (gameState === 'playing') {
      const player = playerRef.current;
      bulletsRef.current.push({
        x: player.x + 20,
        y: player.y + 10,
        active: true
      });
    }
  }, [gameState]);

  // Handle keyboard and touch input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        jump();
      }
      if (e.code === 'KeyZ' || e.code === 'Enter') {
        e.preventDefault();
        shoot();
      }
    };

    const handleTouch = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        // Right side of screen = shoot, left side = jump
        if (x > GAME_WIDTH / 2) {
          shoot();
        } else {
          jump();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('touchstart', handleTouch, { passive: false });
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('touchstart', handleTouch);
    };
  }, [jump, shoot]);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gameLoop = () => {
      if (gameState !== 'playing') {
        // Still draw but don't update physics
        draw(ctx);
        animationRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      // Update physics
      const player = playerRef.current;
      
      // Apply gravity
      player.velocity += GRAVITY;
      player.y += player.velocity;
      
      // Update rotation based on velocity
      player.rotation = Math.min(Math.max(player.velocity * 3, -30), 45);

      // Check floor/ceiling collision
      if (player.y > GAME_HEIGHT - 40 || player.y < 0) {
        setGameState('gameOver');
        if (score > highScore) {
          setHighScore(score);
        }
      }

      // Spawn pipes
      frameCountRef.current++;
      if (frameCountRef.current % PIPE_SPAWN_RATE === 0) {
        const minHeight = 50;
        const maxHeight = GAME_HEIGHT - 200;
        const topHeight = Math.random() * (maxHeight - minHeight) + minHeight;
        pipesRef.current.push({
          x: GAME_WIDTH,
          topHeight,
          gap: 120,
          passed: false
        });
      }

      // Update pipes
      pipesRef.current = pipesRef.current.filter(pipe => {
        pipe.x -= PIPE_SPEED;
        
        // Check collision with player
        const playerHitbox = { x: player.x - 15, y: player.y - 15, w: 30, h: 30 };
        const topPipe = { x: pipe.x, y: 0, w: 50, h: pipe.topHeight };
        const bottomPipe = { x: pipe.x, y: pipe.topHeight + pipe.gap, w: 50, h: GAME_HEIGHT };
        
        if (checkCollision(playerHitbox, topPipe) || checkCollision(playerHitbox, bottomPipe)) {
          setGameState('gameOver');
          if (score > highScore) {
            setHighScore(score);
          }
        }
        
        // Score counting
        if (!pipe.passed && pipe.x + 50 < player.x) {
          pipe.passed = true;
          setScore(s => s + 1);
        }
        
        return pipe.x > -60;
      });

      // Update bullets
      bulletsRef.current = bulletsRef.current.filter(bullet => {
        bullet.x += BULLET_SPEED;
        
        // Check collision with pipes
        let hit = false;
        pipesRef.current = pipesRef.current.filter(pipe => {
          const bulletHitbox = { x: bullet.x - 5, y: bullet.y - 3, w: 10, h: 6 };
          const topPipe = { x: pipe.x, y: 0, w: 50, h: pipe.topHeight };
          const bottomPipe = { x: pipe.x, y: pipe.topHeight + pipe.gap, w: 50, h: GAME_HEIGHT };
          
          if (checkCollision(bulletHitbox, topPipe) || checkCollision(bulletHitbox, bottomPipe)) {
            hit = true;
            setScore(s => s + 2); // Bonus for destroying pipe
            return false; // Remove pipe
          }
          return true;
        });
        
        return bullet.x < GAME_WIDTH && !hit;
      });

      draw(ctx);
      animationRef.current = requestAnimationFrame(gameLoop);
    };

    const draw = (ctx: CanvasRenderingContext2D) => {
      // Clear canvas
      ctx.fillStyle = '#87CEEB';
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      // Draw background clouds
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.beginPath();
      ctx.arc(100, 100, 30, 0, Math.PI * 2);
      ctx.arc(130, 90, 40, 0, Math.PI * 2);
      ctx.arc(160, 100, 30, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.beginPath();
      ctx.arc(280, 150, 25, 0, Math.PI * 2);
      ctx.arc(305, 140, 35, 0, Math.PI * 2);
      ctx.arc(330, 150, 25, 0, Math.PI * 2);
      ctx.fill();

      // Draw ruler on left side
      drawRuler(ctx);

      // Draw pipes
      ctx.fillStyle = '#4CAF50';
      ctx.strokeStyle = '#2E7D32';
      ctx.lineWidth = 2;
      
      pipesRef.current.forEach(pipe => {
        // Top pipe
        ctx.fillRect(pipe.x, 0, 50, pipe.topHeight);
        ctx.strokeRect(pipe.x, 0, 50, pipe.topHeight);
        // Pipe cap
        ctx.fillRect(pipe.x - 5, pipe.topHeight - 20, 60, 20);
        ctx.strokeRect(pipe.x - 5, pipe.topHeight - 20, 60, 20);
        
        // Bottom pipe
        const bottomY = pipe.topHeight + pipe.gap;
        ctx.fillRect(pipe.x, bottomY, 50, GAME_HEIGHT - bottomY);
        ctx.strokeRect(pipe.x, bottomY, 50, GAME_HEIGHT - bottomY);
        // Pipe cap
        ctx.fillRect(pipe.x - 5, bottomY, 60, 20);
        ctx.strokeRect(pipe.x - 5, bottomY, 60, 20);
      });

      // Draw bullets
      ctx.fillStyle = '#FF5722';
      bulletsRef.current.forEach(bullet => {
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, 5, 0, Math.PI * 2);
        ctx.fill();
        // Bullet trail
        ctx.fillStyle = 'rgba(255, 87, 34, 0.5)';
        ctx.beginPath();
        ctx.arc(bullet.x - 8, bullet.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FF5722';
      });

      // Draw player (bird)
      const player = playerRef.current;
      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.rotate((player.rotation * Math.PI) / 180);
      
      // Body
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.ellipse(0, 0, 20, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Eye
      ctx.fillStyle = '#FFF';
      ctx.beginPath();
      ctx.arc(8, -5, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(10, -5, 3, 0, Math.PI * 2);
      ctx.fill();
      
      // Beak
      ctx.fillStyle = '#FF8C00';
      ctx.beginPath();
      ctx.moveTo(15, 0);
      ctx.lineTo(25, 5);
      ctx.lineTo(15, 10);
      ctx.fill();
      
      // Wing
      ctx.fillStyle = '#FFA500';
      ctx.beginPath();
      ctx.ellipse(-5, 5, 12, 8, 0.3, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();

      // Draw UI
      ctx.fillStyle = '#FFF';
      ctx.font = 'bold 24px Arial';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.strokeText(`Score: ${score}`, 50, 40);
      ctx.fillText(`Score: ${score}`, 50, 40);
      
      ctx.font = '16px Arial';
      ctx.strokeText(`Best: ${Math.max(score, highScore)}`, 50, 65);
      ctx.fillText(`Best: ${Math.max(score, highScore)}`, 50, 65);

      // Game state messages
      if (gameState === 'start') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('FLYING GAME', GAME_WIDTH / 2, 200);
        
        ctx.fillStyle = '#FFF';
        ctx.font = '18px Arial';
        ctx.fillText('Click / Space / Tap Left = Jump', GAME_WIDTH / 2, 280);
        ctx.fillText('Z / Enter / Tap Right = Shoot', GAME_WIDTH / 2, 310);
        ctx.fillText('Destroy pipes for bonus!', GAME_WIDTH / 2, 340);
        
        ctx.font = '16px Arial';
        ctx.fillStyle = '#87CEEB';
        ctx.fillText('Tap or Press Space to Start', GAME_WIDTH / 2, 420);
      } else if (gameState === 'gameOver') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        
        ctx.fillStyle = '#FF4444';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', GAME_WIDTH / 2, 250);
        
        ctx.fillStyle = '#FFF';
        ctx.font = '24px Arial';
        ctx.fillText(`Score: ${score}`, GAME_WIDTH / 2, 300);
        ctx.fillText(`Best: ${highScore}`, GAME_WIDTH / 2, 340);
        
        ctx.font = '16px Arial';
        ctx.fillStyle = '#87CEEB';
        ctx.fillText('Tap or Press Space to Restart', GAME_WIDTH / 2, 400);
      }
      
      ctx.textAlign = 'left';
    };

    const drawRuler = (ctx: CanvasRenderingContext2D) => {
      const rulerX = 8;
      const rulerWidth = 30;
      
      // Ruler background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillRect(rulerX, 0, rulerWidth, GAME_HEIGHT);
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.strokeRect(rulerX, 0, rulerWidth, GAME_HEIGHT);
      
      // Ruler markings
      ctx.fillStyle = '#333';
      ctx.font = '10px Arial';
      ctx.textAlign = 'left';
      
      for (let y = 0; y < GAME_HEIGHT; y += 20) {
        const isMajor = y % 100 === 0;
        const markLength = isMajor ? 12 : 6;
        
        ctx.beginPath();
        ctx.moveTo(rulerX + rulerWidth - markLength, y);
        ctx.lineTo(rulerX + rulerWidth, y);
        ctx.stroke();
        
        if (isMajor) {
          ctx.fillText((GAME_HEIGHT - y).toString(), rulerX + 2, y + 3);
        }
      }
      
      // Player position indicator on ruler
      const player = playerRef.current;
      ctx.fillStyle = '#FF4444';
      ctx.beginPath();
      ctx.moveTo(rulerX, player.y);
      ctx.lineTo(rulerX + 10, player.y - 5);
      ctx.lineTo(rulerX + 10, player.y + 5);
      ctx.fill();
    };

    const checkCollision = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    };

    animationRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameState, score, highScore]);

  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-4">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={GAME_WIDTH}
          height={GAME_HEIGHT}
          className="rounded-lg shadow-2xl border-4 border-zinc-700 cursor-pointer"
          style={{ touchAction: 'none' }}
        />
        <div className="mt-4 text-center text-zinc-400 text-sm">
          <p>Space/Click Left = Jump &nbsp;|&nbsp; Z/Click Right = Shoot</p>
        </div>
      </div>
    </div>
  );
}
