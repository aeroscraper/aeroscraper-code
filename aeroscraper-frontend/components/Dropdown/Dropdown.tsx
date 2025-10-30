import { AnimatePresence, motion } from 'framer-motion'
import React, { PropsWithChildren, useCallback, useImperativeHandle, useRef, useState } from 'react'
import useOutsideHandler from '../../hooks/useOutsideHandler'

type Props = {
    toggleButton: React.ReactNode,
    containerClassName?: string,
    menuClassName?: string,
    onOpen?: () => void
}

export type DropdownRef = {
    closeDropdown: () => void;
}

const Dropdown = React.forwardRef<DropdownRef, PropsWithChildren<Props>>(
    ({ children, toggleButton, containerClassName, menuClassName, onOpen }, parentRef) => {
        const ref = useRef(null);
        const [isExpanded, setIsExpanded] = useState(false);

        const outsideDropdownClicked = () => {
            if (isExpanded) {
                setIsExpanded(false);
            }
        }

        const toggleDropdown = () => {
            setIsExpanded(!isExpanded);

            onOpen?.();
        }

        const closeDropdown = useCallback(() => {
            setIsExpanded(false);
        }, [])

        useOutsideHandler(ref, outsideDropdownClicked);

        useImperativeHandle(parentRef, () => ({
            closeDropdown
        }), [closeDropdown])

        return (
            <div className={`relative w-fit h-fit ${containerClassName ?? ''}`} ref={ref}>
                <div className='cursor-pointer' onClick={toggleDropdown}>
                    {toggleButton}
                </div>
                <AnimatePresence>
                    {
                        isExpanded &&
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: '100%' }} exit={{ opacity: 0 }} className={`absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-[105%] z-[1000] ${menuClassName ?? ''}`}>
                            {children}
                        </motion.div>
                    }
                </AnimatePresence>
            </div>
        )
    }
)

Dropdown.displayName = "Dropdown";

export default Dropdown