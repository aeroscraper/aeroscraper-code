import { ExecuteResult } from "@cosmjs/cosmwasm-stargate";
import { toBase64, toUtf8 } from "@cosmjs/encoding";
import { Coin, EncodeObject } from "@cosmjs/proto-signing";
import { TxResponse } from "@injectivelabs/sdk-ts";
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";
import { isNil } from "lodash";

const DEFAULT_DECIMAL = 6;
export const AUSD_PRICE = 1;

export const jsonToBinary = (json: any) => {
    return toBase64(toUtf8(JSON.stringify(json)));
};

export const getAllowanceExecuteMsg = ({
    sender,
    contract = '',
    amount,
    spender,
    funds = []
}: {
    sender: string,
    contract?: string,
    amount: string,
    spender: string,
    funds?: Coin[]
}): EncodeObject => {
    return {
        typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
        value: MsgExecuteContract.fromPartial({
            sender,
            contract,
            msg: toUtf8(
                JSON.stringify({
                    increase_allowance: {
                        amount,
                        spender
                    }
                })
            ),
            funds
        })
    }
}

export const getEncodedExecuteJsonMsg = (sender: string, contract: string, msg: any, funds?: Coin[]): EncodeObject => {
    return {
        typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
        value: MsgExecuteContract.fromPartial({
            sender,
            contract,
            msg: toUtf8(
                JSON.stringify(msg)
            ),
            funds: funds ?? []
        })
    }
}

export const getRequestAmount = (value: string | number, decimal: number = DEFAULT_DECIMAL) => {
    return Math.floor((Number(value) * Math.pow(10, decimal))).toString();
}

export const convertAmount = (value: string | number, decimal: number = DEFAULT_DECIMAL) => {
    return Number((Number(value) / Math.pow(10, decimal)).toFixed(18));
}

export const getValueByRatio = (value: string | number, ratio: string | number) => {
    return Number((Number(value) / Number(ratio)).toFixed(6));
}

export const getRatioColor = (value: number) => {
    if (value < 115) {
        return '#cc2340';
    }
    else if (value > 115 && value < 130) {
        return '#d4b737'
    }

    return '#37D489'
}

export const getRatioText = (value: number) => {
    if (value < 115) {
        return "Troves below 115% collateral ratio will be liquidated. Your trove is in the risky troves range."
    }
    else if (value > 115 && value < 130) {
        return "Troves below 115% collateral ratio will be liquidated. Your trove's risk is moderate."
    }

    return "Troves below 115% collateral ratio will be liquidated. Your trove is in the safe range."
}

export const getIsInjectiveResponse = (res?: ExecuteResult | TxResponse): res is TxResponse => !isNil((res as (TxResponse | undefined))?.txHash)