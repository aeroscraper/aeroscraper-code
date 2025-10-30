import React, { useEffect } from "react";

const useOutsideHandler = (ref: any, outsideClickEvent: () => void) => {
    useEffect(() => {
        function handleClickOutside(event: any) {
            if (ref.current && !ref.current.contains(event.target)) {
                outsideClickEvent();
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [ref, outsideClickEvent]);
}

export default useOutsideHandler;