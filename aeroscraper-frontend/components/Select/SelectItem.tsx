import React, { FC } from 'react'

type SelectItemProps<T> = {
    item: T
    renderItem: (item: T) => React.ReactNode
    onSelect: (item: T) => void
}

const SelectItem = <T,>({ item, renderItem, onSelect }: SelectItemProps<T>) => {
    const select = () => {
        onSelect(item);
    }

    return (
        <div className='w-full cursor-pointer transition' onClick={select}>
            {renderItem(item)}
        </div>
    )
}

export default React.memo(SelectItem);