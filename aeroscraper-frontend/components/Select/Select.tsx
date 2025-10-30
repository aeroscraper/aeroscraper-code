import { isNil } from 'lodash';
import React, { FC, useCallback, useEffect, useRef, useState } from 'react'
import Accordion, { AccordionRef } from '../Accordion/Accordion'
import Text from '../Texts/Text';
import SelectItem from './SelectItem';

type SelectProps<T> = {
    data: T[];
    initialValue?: T;
    onSelect: (item: T) => void;
    keyExtractor: (item: T) => number | string;
    nameExtractor: (item: T) => string;
    renderItem?: (item: T, isSelected: boolean) => React.ReactNode;
    renderSelectedItem?: (item: T) => React.ReactNode;
    placeholder?: string;
    width?: string;
    height?: string;
}

const Select = <T,>({ data, initialValue, onSelect, placeholder = '', nameExtractor, keyExtractor, renderItem, renderSelectedItem, width = "w-full", height = "h-16" }: SelectProps<T>) => {
    const accordionRef = useRef<AccordionRef>(null);
    const [selectedItem, setSelectedItem] = useState<T | undefined>(initialValue);

    const select = useCallback((item: T) => {
        setSelectedItem(item);
        onSelect(item);
        accordionRef.current?.closeAccordion();
    }, [accordionRef, onSelect, setSelectedItem])

    const defaultRenderItem = useCallback((item: T) => {
        return <Text>{nameExtractor(item)}</Text>;
    }, [nameExtractor])

    const renderSelectItem = useCallback((item: T) => {
        const isSelected = isNil(selectedItem) ? false : keyExtractor(selectedItem) === keyExtractor(item);
        return isNil(renderItem) ? defaultRenderItem(item) : renderItem(item, isSelected);
    }, [selectedItem, defaultRenderItem, keyExtractor, renderItem])

    return (
        <Accordion
            text={isNil(selectedItem) ? placeholder : nameExtractor(selectedItem)}
            renderDefault={isNil(selectedItem) ? undefined : renderSelectedItem?.(selectedItem)}
            containerClassName={`w-full ${width} ${height} shrink-0`}
            responsiveText={false}
            ref={accordionRef}
            width={width}
            height={height}
        >
            <div className='w-full flex flex-col gap-4 px-4 pb-4 max-h-[300px] overflow-auto'>
                {
                    data.map((item, idx) => <SelectItem key={idx} item={item} onSelect={select as any} renderItem={renderSelectItem as any} />)
                }
            </div>
        </Accordion>
    )
}

export default Select