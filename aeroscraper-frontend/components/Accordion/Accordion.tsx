"use client"

import React, { FC, PropsWithChildren, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion';
import useOutsideHandler from '../../hooks/useOutsideHandler';
import Text from '../Texts/Text';
import BorderedContainer from '../Containers/BorderedContainer';

export type AccordionRef = {
    closeAccordion: () => void
}

//TODO: Add props named context which is a function that returns a React.ReactNode and takes a parameter named isExpanded
type Props = {
    containerClassName?: string,
    buttonClassName?: string,
    className?: string,
    textClassName?: string,
    responsiveText?: boolean,
    text?: string,
    renderDefault?: React.ReactNode,
    placement?: "bottom" | "top",
    width?: string,
    height?: string
}

const Placement = {
    "bottom": "absolute left-0 bottom-[2px] translate-y-full",
    "top": "absolute left-0 top-[2px] -translate-y-full"
}

const Accordion = React.forwardRef(({
    children,
    buttonClassName,
    className = "",
    text,
    textClassName,
    responsiveText = true,
    placement = "bottom",
    renderDefault,
    width = "w-full",
    height = "h-full"
}: PropsWithChildren<Props>, externalRef) => {
    const ref = useRef(null);
    const [isExpanded, setIsExpanded] = useState<boolean>(false);

    const toggleExpanded = () => {
        setIsExpanded(prev => !prev);
    }

    const closeExpanded = () => {
        setIsExpanded(false);
    }

    useOutsideHandler(ref, closeExpanded);

    useImperativeHandle(externalRef, (): AccordionRef => ({ closeAccordion: closeExpanded }))

    return (
        <BorderedContainer ref={ref} containerClassName={`${width} ${height} ${isExpanded ? "rounded-b-none" : ""}`} className={`relative w-full h-full rounded-lg bg-licorice flex flex-col ${isExpanded ? placement === "bottom" ? 'rounded-b-none' : 'rounded-t-none' : ''}`}>
            <button className={`${buttonClassName ?? ''} w-full h-16 flex justify-between items-center bg-transparent px-4`} onClick={toggleExpanded}>
                {
                    renderDefault ?? <Text size='xl' className={textClassName} responsive={responsiveText}>{text}</Text>
                }
                <img alt='expand' src="/images/arrow-down.svg" className={`${isExpanded ? 'rotate-180' : 'rotate-0'} transition`} />
            </button>
            <AnimatePresence>
                {
                    isExpanded &&
                    <motion.div
                        className={`${className} translate-x-[-3px] w-full h-fit ${Placement[placement]} overflow-auto scrollbar-hidden border-0 z-[900] main-gradient rounded-lg rounded-t-none p-[3px] pt-[2px] box-content`}
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                    >
                        <div className={`w-full h-fit bg-licorice ${placement === "bottom" ? "rounded-b-lg" : "rounded-t-lg"} pt-2`}>
                            {children}
                        </div>
                    </motion.div>
                }
            </AnimatePresence>
        </BorderedContainer>
    )
}
)
Accordion.displayName = "Accordion"
export default Accordion