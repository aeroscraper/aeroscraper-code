import React, { FC, PropsWithChildren } from 'react'
import Tooltip from '../Tooltip/Tooltip'
import Text from '../Texts/Text'

type Props = {
    title: string
}

const TooltipWrapper: FC<PropsWithChildren<Props>> = ({ children, title }) => {
    return (
        <Tooltip containerClassName='flex items-center' width='w-[83px]' title={
            <div className='w-full h-[30px] rounded-lg main-gradient p-[2px]'>
                <div className='w-full h-full flex justify-center items-center bg-licorice rounded-md'>
                    <Text size="xs">{title}</Text>
                </div>
            </div>
        }
        >
            {children}
        </Tooltip >
    )
}

export default TooltipWrapper