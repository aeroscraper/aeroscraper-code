import { isNil } from 'lodash';
import React, { FC, PropsWithChildren } from 'react'

export type TextSizes = 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';

type Props = {
    className?: string,
    size?: TextSizes,
    responsive?: boolean,
    weight?: string,
    textColor?: string,
    dynamicTextColor?: string
}

const textResponsiveSizes: Record<TextSizes, string> = {
    'xs': 'text-[10px] md:text-xs',
    'sm': 'lg:text-sm text-xs',
    'base': 'lg:text-base sm:text-sm text-xs',
    'lg': 'lg:text-lg md:text-base sm:text-sm text-xs',
    'xl': 'lg:text-xl sm:text-base text-xs',
    '2xl': 'lg:text-2xl sm:text-lg text-sm',
    '3xl': 'xl:text-3xl sm:text-2xl text-lg',
    '4xl': 'xl:text-4xl sm:text-3xl text-2xl',
    '5xl': 'xl:text-[40px] sm:text-4xl text-3xl'
}

const Text: FC<PropsWithChildren<Props>> = ({
    children,
    className,
    size = 'xl',
    responsive = true,
    weight = 'font-normal',
    textColor = 'text-ghost-white',
    dynamicTextColor
}) => {

    return (
        <p className={`${className ?? ''} ${responsive ? textResponsiveSizes[size] : `text-${size}`} ${weight} ${isNil(dynamicTextColor) ? textColor : ''}`} style={{ color: dynamicTextColor }}>
            {children}
        </p>
    )
}

export default Text