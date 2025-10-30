"use client"

import React, { FC } from 'react'

type Props = {
    width?: number
    height?: number,
    className?: string
}

const Loading: FC<Props> = ({ width = 200, height = 200, className }) => {
    return (
        <svg viewBox="0 0 100 100" className={className || ""} style={{ width, height, margin: '0 auto' }}>
            <defs>
                <linearGradient id="Gradient" x1="50%" y1="0%" x2="50%" y2="100%" >

                    <stop offset="0%" stopColor="#FFFFFF">
                        <animate attributeName="stopColor" values="#FFFFFF; #FFFFFF; #FFFFFF" dur="4s" repeatCount="indefinite"></animate>
                    </stop>

                    <stop offset="100%" stopColor="#FFFFFF">
                        <animate attributeName="stopColor" values="#FFFFFF; #FFFFFF; #FFFFFF" dur="4s" repeatCount="indefinite"></animate>
                    </stop>

                </linearGradient>
            </defs>
            <circle className="loading-circle" cx="50" cy="50" r="30" fill="none"></circle>
        </svg>
    )
}

export default Loading