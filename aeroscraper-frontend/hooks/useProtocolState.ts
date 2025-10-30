'use client';

import { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useAppKitConnection } from '@reown/appkit-adapter-solana/react';
import { fetchProtocolState, ProtocolStateData } from '@/lib/solana/fetchProtocolState';

export function useProtocolState() {
  const { connection } = useAppKitConnection();
  const [protocolState, setProtocolState] = useState<ProtocolStateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProtocolState = async () => {
      if (!connection) {
        setError('Connection not available');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const state = await fetchProtocolState(connection);
        setProtocolState(state);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch protocol state');
        console.error('Error fetching protocol state:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProtocolState();
  }, [connection]);

  return { protocolState, loading, error };
}
