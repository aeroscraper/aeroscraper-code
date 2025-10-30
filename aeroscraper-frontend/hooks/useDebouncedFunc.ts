import { useCallback, useRef } from "react";

type ArgumentTypes<F extends Function> = F extends (...args: infer A) => any ? A : never;

const useDebouncedFunc = <T extends Function,>(func: T, delay: number): T => {
    const ref = useRef<NodeJS.Timer | number | null>(null);

    const debouncedFunc = useCallback((...args: ArgumentTypes<T>) => {
        clearTimeout(ref.current as number);

        ref.current = setTimeout(() => func(...args), delay);
    }, [func, delay])

    return debouncedFunc as unknown as T;
}

export default useDebouncedFunc;