'use client';

import { useAppKitAccount } from '@reown/appkit/react';
import { useState, useCallback, useMemo } from 'react';
import { useNotification } from '@/contexts/NotificationProvider';

type Status =
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'success'; minted: number; message: string; current?: string; target?: string }
    | { kind: 'skipped'; message: string; current?: string; target?: string }
    | { kind: 'error'; message: string };

export default function RequestCollateralButton() {
    const { address, isConnected } = useAppKitAccount();
    const { addNotification } = useNotification();
    const [status, setStatus] = useState<Status>({ kind: 'idle' });

    const onClick = useCallback(async () => {
        if (!address) return;
        setStatus({ kind: 'loading' });
        try {
            const res = await fetch('/api/faucet/collateral', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ recipient: address }),
            });
            const j = await res.json();
            if (!res.ok) throw new Error(j?.error || 'Request failed');

            // j shape: { ok, minted, currentBefore?, current?, target?, reason? }
            if (j.ok && j.minted > 0) {
                setStatus({ kind: 'success', minted: j.minted, message: 'Collateral minted', current: j.currentBefore, target: j.target });
                addNotification({
                    status: 'success',
                    message: `Minted ${Number(j.minted) / 1e9} collateral`,
                });
            } else if (j.ok && j.minted === 0) {
                const msg = j.reason || 'No mint performed';
                setStatus({ kind: 'skipped', message: msg, current: j.current, target: j.target });
                addNotification({
                    status: 'success',
                    message: msg,
                });
            } else {
                throw new Error('Unexpected response');
            }
        } catch (e: any) {
            const message = e?.message || 'Mint failed';
            setStatus({ kind: 'error', message });
            addNotification({ status: 'error', message });
        }
    }, [address, addNotification]);

    const disabled = !isConnected || status.kind === 'loading';
    const currentHuman = useMemo(() => {
        const raw = (status.kind === 'success' ? status.current : status.kind === 'skipped' ? status.current : undefined);
        return raw ? (Number(raw) / 1e9).toFixed(4) : undefined;
    }, [status]);

    return (
        <div className="flex items-center gap-2">
            <button
                onClick={onClick}
                disabled={disabled}
                className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 disabled:opacity-50 transition"
                title="Top up your devnet collateral balance for testing"
            >
                {status.kind === 'loading' ? 'Requesting…' : 'Devnet faucet'}
            </button>
        </div>
    );
}