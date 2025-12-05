import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from './useWeb3';
import { useToast } from '@/hooks/use-toast';
import type { GameState, SpinResult } from '@shared/schema';

const MIN_BET = 0.001; // Matches contract
const MAX_BET = 0.05;  // Matches 5% rule usually

export function useGameState() {
  const { contract, account, connectWallet } = useWeb3();
  const { toast } = useToast();
  
  const [gameState, setGameState] = useState<GameState>({
    balance: 0,
    betAmount: MIN_BET,
    isSpinning: false,
    lastResult: null,
    comboMultiplier: 1,
    consecutiveWins: 0,
  });

  // Fetch real ETH balance
  useEffect(() => {
    if (account && window.ethereum) {
      const provider = new ethers.BrowserProvider(window.ethereum);
      provider.getBalance(account).then(bal => {
        setGameState(prev => ({
          ...prev,
          balance: parseFloat(ethers.formatEther(bal))
        }));
      });
    }
  }, [account, gameState.isSpinning]);

  const spin = useCallback(async (): Promise<SpinResult | null> => {
    if (!contract || !account) {
      connectWallet();
      return null;
    }

    if (gameState.isSpinning) return null;

    try {
      setGameState(prev => ({ ...prev, isSpinning: true }));

      // 1. Send Transaction
      const tx = await contract.spin({ 
        value: ethers.parseEther(gameState.betAmount.toString()) 
      });

      toast({
        title: "Spinning...",
        description: "Transaction sent to blockchain."
      });

      // 2. Wait for Receipt
      const receipt = await tx.wait();

      // 3. Parse Events to get Result
      // In a real app, you might listen to events, but parsing receipt is direct
      // We need to decode the event log. For simplicity in this UI, we might randomize
      // the visual display or fetch the event args. 
      // Ideally, your contract emits "outcome". 
      
      // Finding the "Spin" event
      const spinEvent = receipt.logs.find((log: any) => {
         try {
            return contract.interface.parseLog(log)?.name === 'Spin';
         } catch (e) { return false; }
      });

      let serverResult: SpinResult | null = null;

      if (spinEvent) {
        const parsed = contract.interface.parseLog(spinEvent);
        const outcome = parseInt(parsed?.args[2]); // The 'outcome' arg from Solidity
        const payout = parseFloat(ethers.formatEther(parsed?.args[3]));

        // Map Solidity 0-100 outcome to Visual Symbols
        // This is a simple mapping for visual purposes
        // 0-45 Lose, 46-80 1.5x, 81-95 2x, 96-99 5x
        
        let visualReels: any = [['cherry', 'cherry', 'cherry'], ['cherry', 'cherry', 'cherry'], ['cherry', 'cherry', 'cherry']];
        
        if (outcome > 95) visualReels = [['diamond', 'diamond', 'diamond'], ['diamond', 'diamond', 'diamond'], ['diamond', 'diamond', 'diamond']];
        else if (outcome > 80) visualReels = [['seven', 'seven', 'seven'], ['seven', 'seven', 'seven'], ['seven', 'seven', 'seven']];
        else if (outcome > 45) visualReels = [['coin', 'coin', 'coin'], ['coin', 'coin', 'coin'], ['coin', 'coin', 'coin']];
        else visualReels = [['cherry', 'coin', 'clover'], ['star', 'fire', 'seven'], ['diamond', 'coin', 'cherry']]; // Losing mix

        serverResult = {
          reels: visualReels,
          winAmount: payout,
          winningLines: payout > 0 ? [1] : [], // Middle line win
          isJackpot: outcome > 95,
          multiplier: payout > 0 ? (payout / gameState.betAmount) : 0
        };
      }

      setGameState(prev => ({
        ...prev,
        isSpinning: false,
        lastResult: serverResult,
        consecutiveWins: (serverResult?.winAmount || 0) > 0 ? prev.consecutiveWins + 1 : 0
      }));

      return serverResult;

    } catch (error: any) {
      console.error(error);
      setGameState(prev => ({ ...prev, isSpinning: false }));
      
      // Parse Solidity Custom Errors
      let msg = "Transaction failed";
      if (error.message.includes("BetTooLow")) msg = "Bet too low!";
      if (error.message.includes("BetTooHigh")) msg = "Bet too high for current pool!";
      if (error.message.includes("InsufficientPoolBalance")) msg = "House pool is empty!";
      
      toast({
        title: "Error",
        description: msg,
        variant: "destructive"
      });
      return null;
    }
  }, [contract, account, gameState.betAmount, connectWallet, toast]);

  // Helper setters
  const setBetAmount = useCallback((amt: number) => setGameState(p => ({...p, betAmount: amt})), []);
  const increaseBet = useCallback(() => setBetAmount(gameState.betAmount + 0.001), [gameState.betAmount]);
  const decreaseBet = useCallback(() => setBetAmount(Math.max(MIN_BET, gameState.betAmount - 0.001)), [gameState.betAmount]);
  const setMinBet = useCallback(() => setBetAmount(MIN_BET), []);
  const setMaxBet = useCallback(() => setBetAmount(MAX_BET), []);
  const doubleBet = useCallback(() => setBetAmount(gameState.betAmount * 2), [gameState.betAmount]);
  const halfBet = useCallback(() => setBetAmount(Math.max(MIN_BET, gameState.betAmount / 2)), [gameState.betAmount]);
  const clearLastResult = useCallback(() => setGameState(p => ({...p, lastResult: null})), []);

  return {
    gameState,
    spin,
    setBetAmount,
    increaseBet,
    decreaseBet,
    setMinBet,
    setMaxBet,
    doubleBet,
    halfBet,
    clearLastResult,
    canSpin: !gameState.isSpinning && !!account,
    minBet: MIN_BET,
    maxBet: MAX_BET,
    isLoading: gameState.isSpinning,
    balanceLoading: false,
  };
}

// Keep these for now to avoid breaking other components, or update them to use contract calls too
export function usePoolStats() { return { data: null, isLoading: false }; }
export function useRecentWins() { return { data: null }; }
