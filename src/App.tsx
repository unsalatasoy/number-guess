import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

interface GameState {
  roomId: string | null;
  playerNumber: string;
  opponentNumber: string | null;
  guesses: Array<{ guess: string; result: string }>;
  isHost: boolean;
  playerCount: number;
  isGameReady: boolean;
  isMyTurn: boolean;
  gameOver: boolean;
  winner: string | null;
}

const SOCKET_URL = process.env.NODE_ENV === 'production' 
  ? 'https://your-server-url.com'  // Replace this with your actual server URL
  : 'http://localhost:3001';

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    roomId: null,
    playerNumber: '',
    opponentNumber: null,
    guesses: [],
    isHost: false,
    playerCount: 0,
    isGameReady: false,
    isMyTurn: false,
    gameOver: false,
    winner: null
  });

  const [inputNumber, setInputNumber] = useState('');
  const [guessInput, setGuessInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on('playerCount', (count: number) => {
      setGameState(prev => ({ ...prev, playerCount: count }));
    });

    newSocket.on('error', (message: string) => {
      setErrorMessage(message);
    });

    newSocket.on('gameReady', () => {
      setGameState(prev => ({ ...prev, isGameReady: true }));
    });

    newSocket.on('guessResult', ({ guess, result }) => {
      setGameState(prev => ({
        ...prev,
        guesses: [...prev.guesses, { guess, result }]
      }));
    });

    newSocket.on('yourTurn', (isTurn: boolean) => {
      setGameState(prev => ({ ...prev, isMyTurn: isTurn }));
    });

    newSocket.on('gameOver', ({ winner }) => {
      setGameState(prev => ({
        ...prev,
        gameOver: true,
        winner
      }));
    });

    newSocket.on('playerDisconnected', () => {
      setErrorMessage('Rakip oyundan ayrıldı');
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const createRoom = () => {
    if (!socket) return;
    const roomId = Math.random().toString(36).substring(2, 8);
    socket.emit('createRoom', roomId);
    setGameState(prev => ({
      ...prev,
      roomId,
      isHost: true,
      playerCount: 1,
      isMyTurn: true
    }));
    setErrorMessage(null);
  };

  const joinRoom = (roomId: string) => {
    if (!socket) return;
    socket.emit('joinRoom', roomId);
    setGameState(prev => ({
      ...prev,
      roomId,
      isHost: false,
      isMyTurn: false
    }));
    setErrorMessage(null);
  };

  const setNumber = (number: string) => {
    if (!socket || !gameState.roomId) return;
    if (number.length === 4 && new Set(number).size === 4) {
      socket.emit('setNumber', { roomId: gameState.roomId, number });
      setGameState(prev => ({
        ...prev,
        playerNumber: number
      }));
    }
  };

  const makeGuess = (guess: string) => {
    if (!socket || !gameState.roomId) return;
    if (guess.length === 4 && new Set(guess).size === 4) {
      socket.emit('makeGuess', { roomId: gameState.roomId, guess });
      setGuessInput('');
    }
  };

  const renderGameStatus = () => {
    if (gameState.gameOver) {
      return (
        <div className="bg-green-500/10 text-green-500 p-4 rounded-lg text-2xl font-bold my-5">
          {gameState.winner === socket?.id ? 'Kazandınız!' : 'Rakip kazandı!'}
        </div>
      );
    }
    if (!gameState.isGameReady) {
      return (
        <div className="bg-primary/10 text-primary p-4 rounded-lg text-lg my-5">
          Rakibin sayısını belirlemesi bekleniyor...
        </div>
      );
    }
    if (!gameState.isMyTurn) {
      return (
        <div className="bg-primary/10 text-primary p-4 rounded-lg text-lg my-5">
          Rakibin tahminini bekleniyor...
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-secondary text-white flex flex-col items-center justify-center p-5">
      <div className="max-w-2xl w-full">
        <h1 className="text-4xl font-bold text-center mb-8 bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent animate-pulse-slow">
          Sayı Tahmin Oyunu
        </h1>
        
        {!gameState.roomId ? (
          <div className="flex flex-col gap-5 items-center">
            <button 
              onClick={createRoom}
              className="bg-primary text-secondary px-6 py-3 rounded-lg font-semibold hover:bg-primary/80 transition-all duration-300 hover:scale-105"
            >
              Oda Oluştur
            </button>
            <div className="flex gap-3 items-center">
              <input
                type="text"
                placeholder="Oda ID'sini Girin"
                onChange={(e) => setInputNumber(e.target.value)}
                className="px-4 py-2 rounded-lg bg-white/10 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-300"
              />
              <button 
                onClick={() => joinRoom(inputNumber)}
                className="bg-primary text-secondary px-6 py-2 rounded-lg font-semibold hover:bg-primary/80 transition-all duration-300 hover:scale-105"
              >
                Odaya Katıl
              </button>
            </div>
            {errorMessage && (
              <div className="bg-red-500/10 text-red-500 p-4 rounded-lg text-sm animate-pulse">
                {errorMessage}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="bg-primary/10 p-4 rounded-lg">
              <div className="text-primary text-lg">
                Oda ID: {gameState.roomId}
                {gameState.isHost ? ' (Oda Sahibi)' : ' (Oyuncu)'}
              </div>
              <div className="text-white/80 text-sm mt-2">
                Oyuncular: {gameState.playerCount}/2
              </div>
            </div>

            {!gameState.playerNumber ? (
              <div className="flex gap-3 justify-center items-center">
                <input
                  type="text"
                  maxLength={4}
                  placeholder="4 haneli sayınızı girin"
                  onChange={(e) => setInputNumber(e.target.value)}
                  className="px-4 py-2 rounded-lg bg-white/10 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button 
                  onClick={() => setNumber(inputNumber)}
                  className="bg-primary text-secondary px-6 py-2 rounded-lg font-semibold hover:bg-primary/80 transition-colors"
                >
                  Sayıyı Belirle
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                <div className="bg-primary/10 p-4 rounded-lg">
                  <div className="text-primary">
                    Sizin Sayınız: <span className="text-white font-bold text-2xl ml-2">{gameState.playerNumber}</span>
                  </div>
                </div>
                {renderGameStatus()}
                {gameState.isGameReady && !gameState.gameOver && (
                  <>
                    <div className="flex gap-3 justify-center items-center">
                      <input
                        type="text"
                        maxLength={4}
                        placeholder="Tahmin yapın"
                        value={guessInput}
                        onChange={(e) => setGuessInput(e.target.value)}
                        disabled={!gameState.isMyTurn}
                        className="px-4 py-2 rounded-lg bg-white/10 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <button 
                        onClick={() => makeGuess(guessInput)}
                        disabled={!gameState.isMyTurn}
                        className="bg-primary text-secondary px-6 py-2 rounded-lg font-semibold hover:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Tahmin Et
                      </button>
                    </div>

                    <div className="flex flex-col gap-3">
                      {gameState.guesses.map((guess, index) => (
                        <div key={index} className="bg-white/10 p-3 rounded-lg text-sm">
                          Tahmin: {guess.guess} - Sonuç: {guess.result}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
