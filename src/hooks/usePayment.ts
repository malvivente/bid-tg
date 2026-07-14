import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { isMock } from '@/lib/api';
import type { TxMessage } from '@/types';

export type PayResult = { status: 'sent' | 'demo' | 'need_connect'; boc?: string };

/**
 * One entry point for every payment (stars cost + fee, premium, bid + fee).
 * Sends all messages in a SINGLE TonConnect signature. In mock mode (no backend
 * / no real target addresses) it simulates so the UI stays fully demoable.
 */
export function usePayment() {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const connected = !!wallet;

  async function pay(messages: TxMessage[], validUntil?: number): Promise<PayResult> {
    if (!connected) {
      await tonConnectUI.openModal();
      return { status: 'need_connect' };
    }
    if (isMock) {
      await new Promise((r) => setTimeout(r, 900));
      return { status: 'demo' };
    }
    const res = await tonConnectUI.sendTransaction({
      validUntil: validUntil ?? Math.floor(Date.now() / 1000) + 360,
      messages: messages.map((m) => ({
        address: m.address,
        amount: m.amount,
        ...(m.payload ? { payload: m.payload } : {}),
        ...(m.stateInit ? { stateInit: m.stateInit } : {}),
      })),
    });
    return { status: 'sent', boc: res.boc };
  }

  return { pay, connected, openModal: () => tonConnectUI.openModal() };
}
