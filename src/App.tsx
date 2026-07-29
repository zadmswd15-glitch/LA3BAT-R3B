import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GameEngine } from './game/GameEngine';
import { soundSystem } from './audio/SoundSystem';
import { voiceTextChat } from './multiplayer/VoiceTextChat';

export default function App() {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const gameEngineRef = useRef<GameEngine | null>(null);

  // Active UI Screen state: 'main' | 'settings' | 'game' | 'multi' | 'shop' | 'jumpscare' | 'gameover'
  const [activeScreen, setActiveScreen] = useState<string>('main');

  // Audio Settings
  const [masterVol, setMasterVol] = useState<number>(70);
  const [musicVol, setMusicVol] = useState<number>(55);
  const [sfxVol, setSfxVol] = useState<number>(80);
  const [voiceVol, setVoiceVol] = useState<number>(65);
  const [muteUnfocused, setMuteUnfocused] = useState<boolean>(true);
  const [binaural, setBinaural] = useState<boolean>(true);

  // HUD & Game State
  const [health, setHealth] = useState<number>(100);
  const [hunger, setHunger] = useState<number>(100);
  const [thirst, setThirst] = useState<number>(100);
  const [points, setPoints] = useState<number>(0);
  const [activePowerups, setActivePowerups] = useState<{ speed: number; jump: number; shield: number }>({ speed: 0, jump: 0, shield: 0 });
  const [roomInfo, setRoomInfo] = useState<{
    id: string;
    count: number;
    isHost: boolean;
    playerList?: Array<{ id: string; name: string; isHost: boolean; status: string }>;
  }>({ id: '', count: 1, isHost: true, playerList: [] });

  const [dayInfo, setDayInfo] = useState<{
    currentDay: number;
    activeQuest: string;
    monsterHp?: number;
    monsterMaxHp?: number;
    isDefeated?: boolean;
  }>({
    currentDay: 1,
    activeQuest: 'Day 1-11 Quest: Find weapons in house & survive until Day 12 to unlock frighten ability!',
    monsterHp: 100,
    monsterMaxHp: 100,
    isDefeated: false
  });

  const [activeWeapon, setActiveWeapon] = useState<'laser_gun' | 'water_gun' | 'stunner' | 'shotgun'>('laser_gun');
  const [notification, setNotification] = useState<string | null>(null);

  const touchLookLastPos = useRef<{ x: number; y: number } | null>(null);

  const leaveHouse = () => {
    if (gameEngineRef.current) {
      gameEngineRef.current.stop();
      gameEngineRef.current = null;
    }
    setRoomInfo({ id: '', count: 1, isHost: true, playerList: [] });
    setActiveScreen('main');
    showNotificationMsg('Exited game. Left the House (تم الخروج من البيت)');
  };

  // Multiplayer & Voice Chat State
  const [multiPage, setMultiPage] = useState<number>(1); // 1 = Rooms & Code, 2 = Voice Mic & Chat
  const [joinRoomInput, setJoinRoomInput] = useState<string>('');
  const [playerNameInput, setPlayerNameInput] = useState<string>('Survivor');
  const [chatMessages, setChatMessages] = useState<Array<{ sender: string; text: string; time: string }>>([
    { sender: 'System', text: 'Welcome to the house! Voice chat and text chat active on Page 2.', time: '00:00' }
  ]);
  const [chatInputText, setChatInputText] = useState<string>('');
  const [isMicMuted, setIsMicMuted] = useState<boolean>(true);
  const [showChatDrawer, setShowChatDrawer] = useState<boolean>(false);

  const toggleMic = async () => {
    if (!voiceTextChat.localStream) {
      const success = await voiceTextChat.initAudioStream();
      if (!success) {
        showNotificationMsg('🎤 Microphone access unavailable or denied!');
        return;
      }
    }
    const muted = voiceTextChat.toggleMute();
    setIsMicMuted(muted);
    showNotificationMsg(muted ? '🔇 Microphone Muted' : '🎙️ Microphone Active (Voice Chat On)');
  };

  const handleSendChat = () => {
    if (!chatInputText.trim()) return;
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const text = chatInputText.trim();
    setChatMessages((prev) => [...prev, { sender: `${playerNameInput} (You)`, text, time: timeStr }]);

    if (gameEngineRef.current && gameEngineRef.current.peerManager) {
      gameEngineRef.current.peerManager.sendChatMessage(text);
    }
    setChatInputText('');
  };

  // Game Over Stats
  const [gameOverStats, setGameOverStats] = useState<{ timeSurvived: number; pointsEarned: number; killersEvaded: number }>({
    timeSurvived: 0,
    pointsEarned: 0,
    killersEvaded: 0
  });

  // Virtual Joystick touch state
  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const [joystickOffset, setJoystickOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Initialize Audio & Game Engine
  useEffect(() => {
    // Check if URL has ?room= parameter
    const params = new URLSearchParams(window.location.search);
    const roomFromUrl = params.get('room');
    if (roomFromUrl) {
      setJoinRoomInput(roomFromUrl);
    }

    // Title Glitch Flicker loop
    const title = document.getElementById('titleText');
    const scheduleGlitch = () => {
      const delay = 2200 + Math.random() * 5000;
      setTimeout(() => {
        if (title) {
          title.classList.add('glitch');
          setTimeout(() => title.classList.remove('glitch'), 200);
        }
        scheduleGlitch();
      }, delay);
    };
    scheduleGlitch();
  }, []);

  // Update Audio System volumes
  useEffect(() => {
    soundSystem.updateVolumes({
      master: masterVol / 100,
      music: musicVol / 100,
      sfx: sfxVol / 100,
      voice: voiceVol / 100,
      muteUnfocused,
      binaural
    });
  }, [masterVol, musicVol, sfxVol, voiceVol, muteUnfocused, binaural]);

  const showNotificationMsg = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  const startGame = async (isMultiplayer: boolean, isHostMode: boolean, targetRoomId?: string) => {
    if (!canvasContainerRef.current) return;

    if (!gameEngineRef.current) {
      gameEngineRef.current = new GameEngine(canvasContainerRef.current, {
        updateHUD: (h, hu, th, pts, pow, rm, d) => {
          setHealth(h);
          setHunger(hu);
          setThirst(th);
          setPoints(pts);
          setActivePowerups(pow);
          setRoomInfo(rm);
          if (d) setDayInfo(d);
        },
        showJumpscare: (type) => {
          setActiveScreen('jumpscare');
          setTimeout(() => {
            setActiveScreen('game');
          }, 1800);
        },
        showGameOver: (stats) => {
          setGameOverStats(stats);
          setActiveScreen('gameover');
        },
        showNotification: (text) => {
          showNotificationMsg(text);
        },
        onChatMessage: (senderId, senderName, text) => {
          const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          setChatMessages((prev) => [...prev, { sender: senderName, text, time: timeStr }]);
          showNotificationMsg(`💬 ${senderName}: ${text}`);
        }
      });
    }

    gameEngineRef.current.start();
    setActiveScreen('game');

    if (isMultiplayer) {
      try {
        if (isHostMode) {
          const roomId = await gameEngineRef.current.peerManager.hostRoom();
          showNotificationMsg(`Hosted Room ID: ${roomId}`);
        } else if (targetRoomId) {
          await gameEngineRef.current.peerManager.joinRoom(targetRoomId, playerNameInput);
          showNotificationMsg(`Connected to Room: ${targetRoomId}`);
        }
      } catch (e) {
        showNotificationMsg(`Multiplayer Connection Failed: ${e}`);
      }
    }
  };

  // Keyboard 'E' interaction listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeScreen !== 'game' || !gameEngineRef.current) return;
      if (e.code === 'KeyE') {
        const action = gameEngineRef.current.interactNearestObject();
        if (action === 'shop') {
          setActiveScreen('shop');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeScreen]);

  // PC Mouse Drag & Pointer Lock Camera Look (Turn right, left, up, down)
  useEffect(() => {
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    const handleMouseDown = (e: MouseEvent) => {
      if (activeScreen !== 'game') return;
      const target = e.target as HTMLElement;
      if (target.closest('.hud-btn') || target.closest('.hud-room-badge') || target.closest('.modal')) return;

      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;

      if (canvasContainerRef.current && document.pointerLockElement !== canvasContainerRef.current) {
        try {
          canvasContainerRef.current.requestPointerLock?.();
        } catch {
          // pointer lock optional fallback to mouse drag
        }
      }
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (activeScreen !== 'game' || !gameEngineRef.current) return;
      const player = gameEngineRef.current.player;

      if (document.pointerLockElement === canvasContainerRef.current) {
        const movementX = e.movementX || 0;
        const movementY = e.movementY || 0;
        player.rotationY -= movementX * 0.003;
        player.pitch -= movementY * 0.003;
        player.pitch = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, player.pitch));
      } else if (isDragging) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;

        player.rotationY -= dx * 0.004;
        player.pitch -= dy * 0.004;
        player.pitch = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, player.pitch));
      }
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [activeScreen]);

  // Multi-Touch Drag Camera Look for mobile phone right side
  const touchLookMapRef = useRef<Map<number, { x: number; y: number }>>(new Map());

  const handleTouchStartScreen = (e: React.TouchEvent) => {
    if (activeScreen !== 'game') return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const target = touch.target as HTMLElement;
      if (
        target.closest('.hud-btn') ||
        target.closest('.virtual-joystick-base') ||
        target.closest('.hud-room-badge') ||
        target.closest('.hud-stats-panel') ||
        target.closest('.modal')
      ) {
        continue;
      }
      if (touch.clientX > window.innerWidth * 0.3) {
        touchLookMapRef.current.set(touch.identifier, { x: touch.clientX, y: touch.clientY });
      }
    }
  };

  const handleTouchMoveScreen = (e: React.TouchEvent) => {
    if (activeScreen !== 'game' || !gameEngineRef.current) return;
    const player = gameEngineRef.current.player;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const prev = touchLookMapRef.current.get(touch.identifier);
      if (prev) {
        const dx = touch.clientX - prev.x;
        const dy = touch.clientY - prev.y;

        player.rotationY -= dx * 0.0045;
        player.pitch -= dy * 0.0045;
        player.pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, player.pitch));

        touchLookMapRef.current.set(touch.identifier, { x: touch.clientX, y: touch.clientY });
      }
    }
  };

  const handleTouchEndScreen = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      touchLookMapRef.current.delete(touch.identifier);
    }
  };

  // Virtual Joystick touch handlers
  const handleJoystickTouch = (e: React.TouchEvent) => {
    if (!joystickBaseRef.current || !gameEngineRef.current) return;
    const rect = joystickBaseRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let dx = touch.clientX - centerX;
    let dy = touch.clientY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxRadius = 40;

    if (distance > maxRadius) {
      dx = (dx / distance) * maxRadius;
      dy = (dy / distance) * maxRadius;
    }

    setJoystickOffset({ x: dx, y: dy });
    gameEngineRef.current.player.touchJoystick = {
      x: dx / maxRadius,
      y: dy / maxRadius
    };
  };

  const resetJoystick = () => {
    setJoystickOffset({ x: 0, y: 0 });
    if (gameEngineRef.current) {
      gameEngineRef.current.player.touchJoystick = { x: 0, y: 0 };
    }
  };

  const copyRoomCode = () => {
    if (roomInfo.id) {
      navigator.clipboard.writeText(roomInfo.id);
      showNotificationMsg(`Room Code copied: ${roomInfo.id}`);
    }
  };

  const copyRoomLink = () => {
    if (roomInfo.id) {
      const url = `${window.location.origin}${window.location.pathname}?room=${roomInfo.id}`;
      navigator.clipboard.writeText(url);
      showNotificationMsg('Room Share Link copied to clipboard!');
    }
  };

  return (
    <>
      <div id="backdrop"></div>
      <div id="grain"></div>
      <div id="vignette"></div>

      {/* 3D GAMEPLAY CANVAS SCREEN */}
      <section
        id="screen-game"
        className={`screen ${activeScreen === 'game' ? 'active' : ''}`}
        onTouchStart={handleTouchStartScreen}
        onTouchMove={handleTouchMoveScreen}
        onTouchEnd={handleTouchEndScreen}
        onTouchCancel={handleTouchEndScreen}
      >
        <div ref={canvasContainerRef} id="canvas-container" />

        {/* HUD OVERLAY */}
        <div className="hud-overlay">
          {/* Day & Active Quest Header Banner */}
          <div style={{
            position: 'absolute',
            top: '12px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.85)',
            border: dayInfo.currentDay >= 30 ? '2px solid #ef4444' : dayInfo.currentDay >= 12 ? '2px solid #fbbf24' : '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            padding: '0.4rem 1.2rem',
            textAlign: 'center',
            zIndex: 10,
            maxWidth: '90vw',
            boxShadow: dayInfo.currentDay >= 30 ? '0 0 20px rgba(239,68,68,0.5)' : 'none'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}>
              <span style={{
                color: dayInfo.currentDay >= 30 ? '#ef4444' : dayInfo.currentDay >= 12 ? '#fbbf24' : '#60a5fa',
                fontWeight: 800,
                fontSize: '0.95rem',
                letterSpacing: '0.1em'
              }}>
                DAY {dayInfo.currentDay} / 30
              </span>
              <span style={{ color: '#888', fontSize: '0.75rem' }}>|</span>
              <span style={{ color: '#fff', fontSize: '0.75rem', fontWeight: 600 }}>
                {dayInfo.currentDay < 12 ? '🔒 UNFRIGHTENED (WAIT TILL DAY 12)' : dayInfo.currentDay < 30 ? '😱 FRIGHTEN MODE UNLOCKED' : '💥 FINAL SHOWDOWN!'}
              </span>
            </div>
            <div style={{ fontSize: '0.68rem', color: 'rgba(201,194,180,0.9)', marginTop: '0.15rem' }}>
              {dayInfo.activeQuest}
            </div>

            {/* Boss HP Bar on Day 30 */}
            {dayInfo.currentDay >= 30 && dayInfo.monsterHp !== undefined && (
              <div style={{ marginTop: '0.4rem', width: '100%', maxWidth: '240px', margin: '0.4rem auto 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: '#ef4444', fontWeight: 700, marginBottom: '0.1rem' }}>
                  <span>SHADOW MONSTER HP</span>
                  <span>{dayInfo.monsterHp} / {dayInfo.monsterMaxHp || 100}</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.1)', height: '7px', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.max(0, (dayInfo.monsterHp / (dayInfo.monsterMaxHp || 100)) * 100)}%`,
                    height: '100%',
                    background: dayInfo.isDefeated ? '#22c55e' : 'linear-gradient(90deg, #991b1b, #ef4444)',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>
            )}
          </div>

          <div className="hud-top" style={{ marginTop: dayInfo.currentDay >= 30 ? '50px' : '40px' }}>
            {/* Survival Stats */}
            <div className="hud-stats-panel">
              <div className="stat-bar-container">
                <div className="stat-bar-label">
                  <span>HEALTH (الدم)</span>
                  <span>{health}%</span>
                </div>
                <div className="stat-bar-bg">
                  <div className="stat-bar-fill stat-health" style={{ width: `${health}%` }} />
                </div>
              </div>

              <div className="stat-bar-container">
                <div className="stat-bar-label">
                  <span>HUNGER (الجوع)</span>
                  <span>{hunger}%</span>
                </div>
                <div className="stat-bar-bg">
                  <div className="stat-bar-fill stat-hunger" style={{ width: `${hunger}%` }} />
                </div>
              </div>

              <div className="stat-bar-container">
                <div className="stat-bar-label">
                  <span>THIRST (العطش)</span>
                  <span>{thirst}%</span>
                </div>
                <div className="stat-bar-bg">
                  <div className="stat-bar-fill stat-thirst" style={{ width: `${thirst}%` }} />
                </div>
              </div>

              <div className="points-badge">
                POINTS: {points}
              </div>

              {/* Active Powerups timers */}
              {(activePowerups.speed > 0 || activePowerups.jump > 0 || activePowerups.shield > 0) && (
                <div style={{ fontSize: '0.65rem', color: '#60a5fa', marginTop: '0.4rem' }}>
                  {activePowerups.shield > 0 && <div>SHIELD: {activePowerups.shield}s</div>}
                  {activePowerups.speed > 0 && <div>SPEED: {activePowerups.speed}s</div>}
                  {activePowerups.jump > 0 && <div>JUMP: {activePowerups.jump}s</div>}
                </div>
              )}
            </div>

            {/* Room Info & Player Lobby Badge */}
            <div className="hud-room-badge" style={{ minWidth: '220px', maxWidth: '300px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                <span style={{ color: '#fbbf24', fontWeight: 600, fontSize: '0.75rem' }}>
                  {roomInfo.id ? `CODE: ${roomInfo.id}` : 'SINGLE PLAYER'}
                </span>
                <span style={{ color: 'var(--ash)', fontSize: '0.65rem' }}>SURVIVORS: {roomInfo.count}</span>
              </div>

              {/* Connected Players List in HUD */}
              <div style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.4rem', margin: '0.4rem 0', borderRadius: '4px' }}>
                <div style={{ fontSize: '0.6rem', color: '#888', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                  PLAYERS IN LOBBY:
                </div>
                <AnimatePresence mode="popLayout">
                  {(roomInfo.playerList && roomInfo.playerList.length > 0
                    ? roomInfo.playerList
                    : [{ id: 'local', name: `${playerNameInput} (You)`, isHost: roomInfo.isHost, status: 'Connected (Online)' }]
                  ).map((p) => (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, x: -15, scale: 0.9 }}
                      transition={{ duration: 0.3 }}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.65rem', marginBottom: '0.2rem' }}
                    >
                      <span style={{ color: p.isHost ? '#fbbf24' : '#fff' }}>
                        {p.name} {p.isHost && '(Host)'}
                      </span>
                      <span style={{ color: '#4ade80', fontSize: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#4ade80' }}></span>
                        {p.status}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                {roomInfo.id && (
                  <>
                    <button
                      className="btn-flat"
                      style={{ padding: '0.25rem 0.4rem', fontSize: '0.58rem', borderColor: '#fbbf24', color: '#fbbf24' }}
                      onClick={copyRoomCode}
                    >
                      COPY CODE
                    </button>
                    <button
                      className="btn-flat"
                      style={{ padding: '0.25rem 0.4rem', fontSize: '0.58rem' }}
                      onClick={copyRoomLink}
                    >
                      LINK
                    </button>
                  </>
                )}
                <button
                  className="btn-flat"
                  style={{ padding: '0.25rem 0.4rem', fontSize: '0.58rem', borderColor: 'var(--blood-lit)', color: '#fff', background: 'rgba(156,28,34,0.3)' }}
                  onClick={leaveHouse}
                >
                  LEAVE HOUSE
                </button>
              </div>
            </div>
          </div>

          <div className="hud-center-crosshair" />

          {/* Weapons & Toys Hotbar */}
          <div style={{
            position: 'absolute',
            bottom: '85px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '0.4rem',
            background: 'rgba(0,0,0,0.8)',
            border: '1px solid var(--line)',
            borderRadius: '6px',
            padding: '0.3rem 0.5rem',
            zIndex: 10
          }}>
            {[
              { id: 'laser_gun', label: '🔫 Laser Gun' },
              { id: 'water_gun', label: '💧 Water Pistol' },
              { id: 'stunner', label: '⚡ Stun Light' },
              { id: 'shotgun', label: '💥 Shotgun' }
            ].map((w) => (
              <button
                key={w.id}
                onClick={() => setActiveWeapon(w.id as any)}
                style={{
                  background: activeWeapon === w.id ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.05)',
                  border: activeWeapon === w.id ? '1px solid #fbbf24' : '1px solid rgba(255,255,255,0.15)',
                  color: activeWeapon === w.id ? '#fbbf24' : '#aaa',
                  padding: '0.3rem 0.6rem',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {w.label}
              </button>
            ))}
          </div>

          {/* Bottom Mobile Touch Controls */}
          <div className="hud-bottom">
            {/* Virtual Joystick for movement */}
            <div className="mobile-controls" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
              <span style={{ fontSize: '0.58rem', color: 'rgba(201,194,180,0.7)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                🕹️ MOVE (التحرك)
              </span>
              <div
                ref={joystickBaseRef}
                className="virtual-joystick-base"
                onTouchStart={handleJoystickTouch}
                onTouchMove={handleJoystickTouch}
                onTouchEnd={resetJoystick}
              >
                <div
                  className="virtual-joystick-stick"
                  style={{
                    transform: `translate(${joystickOffset.x}px, ${joystickOffset.y}px)`
                  }}
                />
              </div>
            </div>

            {/* Center Phone Touch Drag Indicator & D-Pad Look */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', margin: '0 0.4rem', pointerEvents: 'auto' }}>
              <span style={{ fontSize: '0.55rem', color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.08em', background: 'rgba(0,0,0,0.6)', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(251,191,36,0.3)', textAlign: 'center' }}>
                📱 SWIPE RIGHT SCREEN TO LOOK
              </span>
              <button
                className="hud-btn"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.6rem', background: 'rgba(255,255,255,0.1)' }}
                onClick={() => gameEngineRef.current?.player.addTouchLook(0, -20)}
              >
                ▲ UP
              </button>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button
                  className="hud-btn"
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.6rem', background: 'rgba(255,255,255,0.1)' }}
                  onClick={() => gameEngineRef.current?.player.addTouchLook(-25, 0)}
                >
                  ◀ LEFT
                </button>
                <button
                  className="hud-btn"
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.6rem', background: 'rgba(255,255,255,0.1)' }}
                  onClick={() => gameEngineRef.current?.player.addTouchLook(25, 0)}
                >
                  RIGHT ▶
                </button>
              </div>
              <button
                className="hud-btn"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.6rem', background: 'rgba(255,255,255,0.1)' }}
                onClick={() => gameEngineRef.current?.player.addTouchLook(0, 20)}
              >
                ▼ DOWN
              </button>
            </div>

            {/* Right Action Touch Buttons */}
            <div className="action-buttons">
              <button
                className="hud-btn"
                style={{
                  borderColor: '#ef4444',
                  color: '#fff',
                  background: 'linear-gradient(135deg, rgba(239,68,68,0.5), rgba(156,28,34,0.7))',
                  fontWeight: 800,
                  boxShadow: '0 0 12px rgba(239,68,68,0.6)',
                  gridColumn: 'span 2',
                  padding: '0.6rem 0.8rem',
                  fontSize: '0.78rem'
                }}
                onClick={() => gameEngineRef.current?.fireWeapon(activeWeapon)}
              >
                🔴 FIRE (إطلاق 🔫)
              </button>
              <button className="hud-btn" onClick={() => gameEngineRef.current?.player.toggleFlashlight()}>
                🔦 FLASH
              </button>
              <button className="hud-btn" onClick={() => gameEngineRef.current?.player.jump()}>
                🦘 JUMP
              </button>
              <button className="hud-btn" onClick={() => gameEngineRef.current?.player.toggleCrouch()}>
                🧎 CROUCH
              </button>
              <button
                className="hud-btn"
                style={{ borderColor: 'var(--blood-lit)', color: '#fff' }}
                onClick={() => {
                  const action = gameEngineRef.current?.interactNearestObject();
                  if (action === 'shop') setActiveScreen('shop');
                }}
              >
                🛒 SHOP
              </button>
              <button
                className="hud-btn"
                style={{ borderColor: isMicMuted ? '#888' : '#ef4444', color: isMicMuted ? '#aaa' : '#ff5555' }}
                onClick={toggleMic}
              >
                {isMicMuted ? '🔇 MIC' : '🎙️ MIC ON'}
              </button>
              <button
                className="hud-btn"
                style={{ borderColor: '#60a5fa', color: '#93c5fd' }}
                onClick={() => setShowChatDrawer(!showChatDrawer)}
              >
                💬 CHAT
              </button>
            </div>
          </div>

          {/* In-Game Voice & Chat Overlay Drawer */}
          {showChatDrawer && (
            <div style={{
              position: 'absolute',
              top: '65px',
              right: '15px',
              width: '280px',
              background: 'rgba(0,0,0,0.85)',
              border: '1px solid #4a0000',
              borderRadius: '6px',
              padding: '0.6rem',
              zIndex: 30,
              boxShadow: '0 0 15px rgba(0,0,0,0.9)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 700 }}>💬 IN-GAME CHAT</span>
                <button
                  onClick={() => setShowChatDrawer(false)}
                  style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                  ✕
                </button>
              </div>
              <div style={{
                height: '130px',
                overflowY: 'auto',
                background: '#0a0a0a',
                border: '1px solid #222',
                borderRadius: '4px',
                padding: '0.4rem',
                fontSize: '0.65rem',
                marginBottom: '0.4rem'
              }}>
                {chatMessages.map((m, idx) => (
                  <div key={idx} style={{ marginBottom: '0.2rem' }}>
                    <span style={{ color: '#ef4444', fontWeight: 700 }}>{m.sender}: </span>
                    <span style={{ color: '#eee' }}>{m.text}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                <input
                  type="text"
                  placeholder="Type chat..."
                  value={chatInputText}
                  onChange={(e) => setChatInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                  style={{ flex: 1, background: '#111', border: '1px solid #333', color: '#fff', padding: '0.3rem', fontSize: '0.65rem' }}
                />
                <button
                  className="btn-flat"
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.6rem', borderColor: '#ef4444', color: '#ef4444' }}
                  onClick={handleSendChat}
                >
                  SEND
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* NOTIFICATION BANNER */}
      {notification && <div className="notification-banner">{notification}</div>}

      {/* MAIN MENU */}
      <section id="screen-main" className={`screen ${activeScreen === 'main' ? 'active' : ''}`}>
        <div className="title-wrap">
          <h1 className="title" id="titleText">HOLLOW HOUSE</h1>
          <div className="subtitle">it remembers you</div>
          <div style={{
            marginTop: '0.7rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: 'rgba(239,68,68,0.15)',
            border: '1px solid rgba(239,68,68,0.4)',
            color: '#fbbf24',
            padding: '0.35rem 0.85rem',
            borderRadius: '20px',
            fontSize: '0.68rem',
            fontWeight: 700,
            letterSpacing: '0.08em'
          }}>
            📱 PHONE & MOBILE TOUCH READY (دعم كامل للهواتف واللمس)
          </div>
        </div>

        <nav className="menu">
          <button className="menu-btn primary" data-action="single" onClick={() => startGame(false, true)}>
            <span className="num">01</span>Play Alone (Offline Single Player)
          </button>
          <button className="menu-btn" data-action="multi" onClick={() => setActiveScreen('multi')}>
            <span className="num">02</span>Multiplayer Lobby
          </button>
          <button className="menu-btn" data-action="settings" onClick={() => setActiveScreen('settings')}>
            <span className="num">03</span>Audio Settings 🔊
          </button>
          <button
            className="menu-btn"
            data-action="quit"
            onClick={leaveHouse}
          >
            <span className="num">04</span>Leave the House
          </button>
        </nav>

        <div className="menu-foot">v0.9.1 &nbsp;·&nbsp; do not play alone in the dark</div>
      </section>

      {/* MULTIPLAYER LOBBY SCREEN */}
      <section id="screen-multi" className={`screen ${activeScreen === 'multi' ? 'active' : ''}`}>
        <div className="panel" style={{ textTransform: 'uppercase', position: 'relative', maxWidth: '640px' }}>
          {/* Top Right X Close Button */}
          <button
            onClick={() => setActiveScreen('main')}
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid var(--line)',
              color: '#fff',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Close Lobby (X)"
          >
            ✕
          </button>

          {/* Game Title Header on side/above */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem', paddingRight: '40px' }}>
            <h2 style={{ margin: 0, color: '#ef4444', textShadow: '0 0 10px rgba(239,68,68,0.6)', letterSpacing: '0.05em' }}>
              THE HOLLOW HOUSE
            </h2>
            <span style={{ fontSize: '0.65rem', color: '#fbbf24', background: 'rgba(251,191,36,0.15)', padding: '0.2rem 0.6rem', borderRadius: '4px', border: '1px solid #fbbf24', textTransform: 'uppercase', fontWeight: 700 }}>
              MULTIPLAYER
            </span>
          </div>

          {/* PAGE SWITCHER TABS (PAGE 1 vs PAGE 2) */}
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem' }}>
            <button
              onClick={() => setMultiPage(1)}
              style={{
                flex: 1,
                padding: '0.5rem 0.6rem',
                fontSize: '0.72rem',
                fontWeight: 700,
                background: multiPage === 1 ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.05)',
                border: multiPage === 1 ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.15)',
                color: multiPage === 1 ? '#fff' : '#aaa',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              🎮 PAGE 1: ROOMS & CODE (غرف الكود)
            </button>
            <button
              onClick={() => setMultiPage(2)}
              style={{
                flex: 1,
                padding: '0.5rem 0.6rem',
                fontSize: '0.72rem',
                fontWeight: 700,
                background: multiPage === 2 ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.05)',
                border: multiPage === 2 ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.15)',
                color: multiPage === 2 ? '#fff' : '#aaa',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              🎙️ PAGE 2: MIC & CHAT (المايك والدردشة)
            </button>
          </div>

          {/* PAGE 1 CONTENT: ROOMS & LOBBY */}
          {multiPage === 1 && (
            <div>
              {/* Phone & Friend Guide Box */}
              <div style={{
                background: 'rgba(251,191,36,0.08)',
                border: '1px solid rgba(251,191,36,0.3)',
                borderRadius: '6px',
                padding: '0.6rem 0.8rem',
                marginBottom: '0.9rem',
                textTransform: 'none'
              }}>
                <div style={{ fontSize: '0.72rem', color: '#fbbf24', fontWeight: 700, marginBottom: '0.2rem' }}>
                  📱 HOW TO PLAY WITH A FRIEND ON PHONE:
                </div>
                <ol style={{ fontSize: '0.66rem', color: 'rgba(201,194,180,0.85)', margin: 0, paddingLeft: '1.2rem', lineHeight: '1.4' }}>
                  <li><strong>Player 1 (Host):</strong> Tap "HOST NEW ROOM" below to open a room and get a 4-digit code (e.g. <span style={{ color: '#fbbf24' }}>DARK-7291</span>).</li>
                  <li><strong>Player 2 (Friend):</strong> Type <span style={{ color: '#fbbf24' }}>DARK-7291</span> into the Join box below and tap <strong>JOIN ROOM</strong>.</li>
                  <li>Tap <strong>ENTER ROOM</strong> to enter the 3D horror house together!</li>
                </ol>
              </div>

              {/* Survivor Name Input */}
              <div className="slider-row">
                <div className="label-row"><span>Survivor Name (اسم الناجي)</span></div>
                <input
                  type="text"
                  value={playerNameInput}
                  onChange={(e) => setPlayerNameInput(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.6)',
                    border: '1px solid var(--line)',
                    color: 'var(--ash)',
                    padding: '0.5rem',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              <div style={{ margin: '1rem 0', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {/* 1. Open Room (Host New Room) */}
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--line)', padding: '0.8rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#fbbf24', marginBottom: '0.3rem', fontWeight: 600 }}>
                    1. OPEN ROOM (إنشاء غرفة جديدة)
                  </div>
                  <p style={{ fontSize: '0.63rem', color: 'rgba(201,194,180,0.7)', margin: '0 0 0.5rem 0', textTransform: 'none' }}>
                    Generates a unique Room Code for your friends to join.
                  </p>
                  <button
                    className="btn-flat"
                    style={{ width: '100%', borderColor: 'var(--blood-lit)', background: 'rgba(156,28,34,0.2)' }}
                    onClick={() => startGame(true, true)}
                  >
                    HOST NEW ROOM (فتح غرفة)
                  </button>
                </div>

                {/* 2. Join Room */}
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--line)', padding: '0.8rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#60a5fa', marginBottom: '0.3rem', fontWeight: 600 }}>
                    2. JOIN ROOM (الانضمام لغرفة صديق)
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                    <input
                      type="text"
                      placeholder="ENTER CODE (e.g. HOLLOW-8492)"
                      value={joinRoomInput}
                      onChange={(e) => setJoinRoomInput(e.target.value)}
                      style={{
                        flex: 1,
                        background: 'rgba(0,0,0,0.6)',
                        border: '1px solid var(--line)',
                        color: '#fbbf24',
                        padding: '0.5rem',
                        fontFamily: 'inherit',
                        fontSize: '0.75rem',
                        letterSpacing: '0.1em'
                      }}
                    />
                    <button
                      className="btn-flat"
                      style={{ borderColor: '#60a5fa', padding: '0.5rem 1rem' }}
                      onClick={() => {
                        if (joinRoomInput.trim()) {
                          startGame(true, false, joinRoomInput.trim());
                        } else {
                          showNotificationMsg('Please enter a room code!');
                        }
                      }}
                    >
                      JOIN ROOM
                    </button>
                  </div>
                </div>

                {/* 3. Enter Room Action */}
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #22c55e', padding: '0.8rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#22c55e', marginBottom: '0.3rem', fontWeight: 600 }}>
                    3. ENTER THE ROOM & PLAY
                  </div>
                  <button
                    className="btn-flat"
                    style={{ width: '100%', borderColor: '#22c55e', background: 'rgba(34,197,94,0.15)', color: '#4ade80', fontWeight: 700 }}
                    onClick={() => {
                      if (roomInfo.id) {
                        setActiveScreen('game');
                      } else {
                        startGame(true, true);
                      }
                    }}
                  >
                    ENTER THE ROOM (دخول اللعبة)
                  </button>
                </div>
              </div>

              {/* Quick Jump to Page 2 Button */}
              <button
                className="btn-flat"
                style={{ width: '100%', borderColor: '#ef4444', color: '#fca5a5', marginTop: '0.5rem', padding: '0.4rem', fontSize: '0.68rem' }}
                onClick={() => setMultiPage(2)}
              >
                🎙️ OPEN PAGE 2: MIC & CHAT (انتقل للصفحة الثانية للدردشة) ▶
              </button>
            </div>
          )}

          {/* PAGE 2 CONTENT: COMPACT SHRUNK VOICE MIC & CHAT */}
          {multiPage === 2 && (
            <div>
              <div style={{
                background: 'rgba(0,0,0,0.7)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '6px',
                padding: '0.7rem',
                marginBottom: '1rem'
              }}>
                <div style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 700, marginBottom: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>🎙️ VOICE MIC CONTROL (المايك)</span>
                  <span style={{ fontSize: '0.62rem', color: isMicMuted ? '#888' : '#22c55e' }}>
                    {isMicMuted ? '● MUTED' : '● VOICE TRANSMITTING'}
                  </span>
                </div>

                {/* Shrunk Compact Mic Toggle Button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'rgba(255,255,255,0.03)', padding: '0.5rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <button
                    className="btn-flat"
                    style={{
                      padding: '0.35rem 0.8rem',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      borderColor: isMicMuted ? '#888' : '#ef4444',
                      color: isMicMuted ? '#aaa' : '#ff4040',
                      background: isMicMuted ? 'rgba(255,255,255,0.05)' : 'rgba(239,68,68,0.25)',
                      boxShadow: isMicMuted ? 'none' : '0 0 10px rgba(239,68,68,0.5)'
                    }}
                    onClick={toggleMic}
                  >
                    {isMicMuted ? '🔇 TAP TO UNMUTE MIC' : '🎙️ MIC IS ON (TAP TO MUTE)'}
                  </button>
                  <span style={{ fontSize: '0.62rem', color: 'rgba(201,194,180,0.7)', textTransform: 'none' }}>
                    {isMicMuted ? 'Microphone is off' : 'Talking to teammates in room'}
                  </span>
                </div>
              </div>

              {/* Shrunk Compact Whispers Text Chat Box */}
              <div style={{
                background: 'rgba(0,0,0,0.7)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '6px',
                padding: '0.7rem',
                marginBottom: '1rem'
              }}>
                <div style={{ fontSize: '0.72rem', color: '#fbbf24', fontWeight: 700, marginBottom: '0.4rem' }}>
                  💬 WHISPERS TEXT CHAT (الدردشة الكتابية)
                </div>

                {/* Shrunk Chat Messages View */}
                <div style={{
                  height: '95px',
                  overflowY: 'auto',
                  background: '#050505',
                  border: '1px solid #2a0000',
                  borderRadius: '4px',
                  padding: '0.4rem',
                  marginBottom: '0.5rem',
                  fontSize: '0.65rem',
                  textTransform: 'none'
                }}>
                  {chatMessages.map((m, idx) => (
                    <div key={idx} style={{ marginBottom: '0.25rem', lineHeight: '1.25' }}>
                      <span style={{ color: '#ef4444', fontWeight: 700 }}>{m.sender}: </span>
                      <span style={{ color: '#ddd' }}>{m.text}</span>
                      <span style={{ color: '#555', fontSize: '0.58rem', marginLeft: '0.3rem' }}>[{m.time}]</span>
                    </div>
                  ))}
                </div>

                {/* Send Input Row */}
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <input
                    type="text"
                    placeholder="Type whisper message..."
                    value={chatInputText}
                    onChange={(e) => setChatInputText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                    style={{
                      flex: 1,
                      background: '#111',
                      border: '1px solid #4a0000',
                      color: '#eee',
                      padding: '0.35rem 0.5rem',
                      fontSize: '0.68rem',
                      borderRadius: '4px'
                    }}
                  />
                  <button
                    className="btn-flat"
                    style={{ padding: '0.35rem 0.7rem', fontSize: '0.62rem', borderColor: '#ef4444', color: '#ef4444' }}
                    onClick={handleSendChat}
                  >
                    SEND
                  </button>
                </div>
              </div>

              {/* Navigation Actions for Page 2 */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn-flat"
                  style={{ flex: 1, borderColor: '#60a5fa', color: '#93c5fd', padding: '0.4rem', fontSize: '0.68rem' }}
                  onClick={() => setMultiPage(1)}
                >
                  ◀ BACK TO PAGE 1 (ROOMS)
                </button>
                <button
                  className="btn-flat"
                  style={{ flex: 1, borderColor: '#22c55e', color: '#4ade80', background: 'rgba(34,197,94,0.15)', padding: '0.4rem', fontSize: '0.68rem', fontWeight: 700 }}
                  onClick={() => {
                    if (roomInfo.id) {
                      setActiveScreen('game');
                    } else {
                      startGame(true, true);
                    }
                  }}
                >
                  ENTER THE ROOM (دخول)
                </button>
              </div>
            </div>
          )}

          {/* Active Room Info & Connected Players List if in a Room */}
          {roomInfo.id && (
            <div style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid var(--blood-lit)', padding: '0.8rem', margin: '0.8rem 0', borderRadius: '4px' }}>
              <div style={{ color: '#fbbf24', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                CURRENT ROOM CODE: {roomInfo.id}
              </div>
              <div style={{ color: 'rgba(201,194,180,0.8)', fontSize: '0.65rem', marginBottom: '0.6rem', textTransform: 'none' }}>
                Give code <strong style={{ color: '#fbbf24' }}>{roomInfo.id}</strong> to your friends to enter.
              </div>

              <div style={{ marginBottom: '0.6rem' }}>
                <div style={{ fontSize: '0.65rem', color: '#888', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                  PLAYERS CURRENTLY IN LOBBY ({roomInfo.playerList?.length || 1}):
                </div>
                <AnimatePresence mode="popLayout">
                  {(roomInfo.playerList && roomInfo.playerList.length > 0
                    ? roomInfo.playerList
                    : [{ id: 'local', name: `${playerNameInput} (You)`, isHost: roomInfo.isHost, status: 'Connected (Online)' }]
                  ).map((p) => (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: -15, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, x: -15, scale: 0.9 }}
                      transition={{ duration: 0.35, ease: 'easeOut' }}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'rgba(255,255,255,0.05)',
                        padding: '0.4rem 0.6rem',
                        marginBottom: '0.3rem',
                        borderRadius: '4px',
                        borderLeft: p.isHost ? '3px solid #fbbf24' : '3px solid #4ade80'
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 600, color: '#fff', fontSize: '0.75rem' }}>{p.name}</span>
                        {p.isHost && (
                          <span style={{ marginLeft: '0.4rem', fontSize: '0.55rem', color: '#fbbf24', border: '1px solid #fbbf24', padding: '0.1rem 0.2rem', borderRadius: '3px' }}>
                            HOST
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#4ade80', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80', display: 'inline-block' }}></span>
                        {p.status}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn-flat"
                  style={{ flex: 1, borderColor: '#22c55e', color: '#22c55e', padding: '0.4rem' }}
                  onClick={() => setActiveScreen('game')}
                >
                  ENTER HOUSE (الدخول للبيت)
                </button>
                <button
                  className="btn-flat"
                  style={{ flex: 1, borderColor: 'var(--blood-lit)', color: '#fff', background: 'rgba(156,28,34,0.3)', padding: '0.4rem' }}
                  onClick={leaveHouse}
                >
                  LEAVE THE HOUSE (الخروج)
                </button>
              </div>
            </div>
          )}

          <div className="panel-actions">
            <button className="btn-flat" onClick={() => setActiveScreen('main')}>Back to Main Menu</button>
          </div>
        </div>
      </section>

      {/* SETTINGS */}
      <section id="screen-settings" className={`screen ${activeScreen === 'settings' ? 'active' : ''}`}>
        <div className="panel" style={{ position: 'relative' }}>
          {/* Top Right X Close Button */}
          <button
            onClick={() => setActiveScreen('main')}
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid var(--line)',
              color: '#fff',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Close Settings (X)"
          >
            ✕
          </button>

          <h2>Audio Settings & Sound System</h2>

          <div style={{
            background: 'rgba(34,197,94,0.15)',
            border: '1px solid #22c55e',
            borderRadius: '4px',
            padding: '0.6rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span style={{ fontSize: '0.7rem', color: '#4ade80' }}>
              WebAudio Status: Ready & Enabled
            </span>
            <button
              className="btn-flat"
              style={{ padding: '0.3rem 0.6rem', fontSize: '0.65rem', borderColor: '#22c55e', color: '#fff' }}
              onClick={() => {
                soundSystem.init();
                soundSystem.playWeaponShot();
                showNotificationMsg('🔊 Audio Unmuted! Sound initialized successfully.');
              }}
            >
              🔊 TEST / UNMUTE AUDIO
            </button>
          </div>

          <div className="slider-row">
            <div className="label-row"><span>Master Volume</span><span className="val" id="valMaster">{masterVol}%</span></div>
            <input type="range" min="0" max="100" value={masterVol} id="sldMaster" onChange={(e) => setMasterVol(Number(e.target.value))} />
          </div>
          <div className="slider-row">
            <div className="label-row"><span>Ambience / Music</span><span className="val" id="valMusic">{musicVol}%</span></div>
            <input type="range" min="0" max="100" value={musicVol} id="sldMusic" onChange={(e) => setMusicVol(Number(e.target.value))} />
          </div>
          <div className="slider-row">
            <div className="label-row"><span>Sound Effects</span><span className="val" id="valSfx">{sfxVol}%</span></div>
            <input type="range" min="0" max="100" value={sfxVol} id="sldSfx" onChange={(e) => setSfxVol(Number(e.target.value))} />
          </div>
          <div className="slider-row">
            <div className="label-row"><span>Voice / Whispers</span><span className="val" id="valVoice">{voiceVol}%</span></div>
            <input type="range" min="0" max="100" value={voiceVol} id="sldVoice" onChange={(e) => setVoiceVol(Number(e.target.value))} />
          </div>

          <div className="toggle-row">
            <span>Mute When Unfocused</span>
            <div className={`toggle ${muteUnfocused ? 'on' : ''}`} id="toggleMute" onClick={() => setMuteUnfocused(!muteUnfocused)}></div>
          </div>
          <div className="toggle-row">
            <span>Binaural / 3D Audio</span>
            <div className={`toggle ${binaural ? 'on' : ''}`} id="toggleBinaural" onClick={() => setBinaural(!binaural)}></div>
          </div>

          <div className="panel-actions">
            <button className="btn-flat" data-action="main" onClick={() => setActiveScreen('main')}>Close (X)</button>
            <button className="btn-flat" data-action="main" onClick={() => setActiveScreen('main')}>Apply Settings</button>
          </div>
        </div>
      </section>

      {/* SUPERMARKET IN-GAME SHOP MODAL */}
      <section id="screen-shop" className={`screen ${activeScreen === 'shop' ? 'active' : ''}`}>
        <div className="panel" style={{ width: 'min(550px, 92vw)' }}>
          <h2>SUPERMARKET SHOP — الدكانة</h2>
          <div style={{ fontSize: '0.75rem', color: '#fbbf24', marginBottom: '0.8rem' }}>
            AVAILABLE POINTS: {points} PTS
          </div>

          <div className="shop-grid">
            {gameEngineRef.current?.shopItems.map((item) => (
              <div key={item.id} className="shop-item-card">
                <div className="shop-item-info">
                  <h4>{item.nameEn} ({item.nameAr})</h4>
                  <p>{item.description}</p>
                </div>
                <button
                  className="shop-buy-btn"
                  onClick={() => {
                    gameEngineRef.current?.buyShopItem(item.id);
                  }}
                >
                  {item.cost} PTS
                </button>
              </div>
            ))}
          </div>

          <div className="panel-actions">
            <button className="btn-flat" onClick={() => setActiveScreen('game')}>Resume Game</button>
          </div>
        </div>
      </section>

      {/* JUMPSCARE SCREEN OVERLAY */}
      <section id="screen-jumpscare" className={`screen ${activeScreen === 'jumpscare' ? 'active' : ''}`}>
        <div className="jumpscare-face">
          IT SAW YOU
        </div>
      </section>

      {/* GAME OVER SCREEN */}
      <section id="screen-gameover" className={`screen ${activeScreen === 'gameover' ? 'active' : ''}`}>
        <div className="gameover-box">
          <h2>CONSUMED BY THE HOLLOW</h2>
          <p style={{ fontSize: '0.7rem', color: 'rgba(201,194,180,0.6)', letterSpacing: '0.2em' }}>
            YOU DID NOT SURVIVE THE NIGHT
          </p>

          <div className="gameover-stats">
            <div>TIME SURVIVED: {gameOverStats.timeSurvived} SECONDS</div>
            <div>POINTS EARNED: {gameOverStats.pointsEarned}</div>
            <div>KILLERS EVADED: {gameOverStats.killersEvaded}</div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button
              className="btn-flat"
              style={{ flex: 1, borderColor: '#22c55e', color: '#fff' }}
              onClick={() => {
                gameEngineRef.current?.respawnPlayer();
                setActiveScreen('game');
              }}
            >
              RESPAWN IN HOUSE
            </button>
            <button
              className="btn-flat"
              style={{ flex: 1, borderColor: 'var(--blood-lit)', color: '#fff' }}
              onClick={leaveHouse}
            >
              LEAVE THE HOUSE
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
