import React, { PropsWithChildren } from 'react'

type Props = {
    className?: string,
    containerClassName?: string,
    style?: React.CSSProperties,
}

const BorderedContainer = React.forwardRef<any, PropsWithChildren<Props>>(({ children, className = '', containerClassName = '', style }, ref) => {
    return (
        <div ref={ref} className={`${containerClassName} main-gradient rounded-lg relative p-[3px]`}>
            <div className={`${className} w-full h-full rounded-[6px] relative bg-licorice`} style={style}>
                {children}
            </div>
        </div>
    )
})

BorderedContainer.displayName = "BorderedContainer";

export default BorderedContainer