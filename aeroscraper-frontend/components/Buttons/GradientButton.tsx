import React, { PropsWithChildren } from 'react'
import Text from '@/components/Texts/Text';
import Loading from '../Loading/Loading';
import Tooltip, { PLACEMENT_CLASSES } from '../Tooltip/Tooltip';
import { isNil } from 'lodash';

type Props = {
    startIcon?: React.ReactNode;
    endIcon?: React.ReactNode;
    rounded?: string;
    loading?: boolean
    disabledText?: string;
    tooltipPlacement?: keyof typeof PLACEMENT_CLASSES;
} & React.ButtonHTMLAttributes<Element>

const GradientButton: React.FC<PropsWithChildren<Props>> = ({
    className = '',
    rounded = 'rounded-3xl',
    startIcon,
    endIcon,
    loading = false,
    children,
    disabledText,
    tooltipPlacement,
    ...rest
}
) => {

    return (
        <Tooltip placement={tooltipPlacement} active={!!rest.disabled && !isNil(disabledText)} title={<Text size='base'>{disabledText}</Text>} >
            <button
                disabled={loading}
                className={`py-5 ${className} main-gradient flex justify-between gap-2 items-center ${rounded} active:scale-95 transition-all disabled:opacity-60 disabled:active:scale-100 disabled:cursor-not-allowed`}
                {...rest}
            >
                {startIcon}
                <div className='flex-1 text-ghost-white'>
                    {loading ?
                        <Loading width={28} height={28} />
                        : children
                    }
                </div>
                {endIcon}
            </button>
        </Tooltip>

    )
}

export default GradientButton