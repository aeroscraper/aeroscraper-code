import { ChangeEvent, FC, useRef } from 'react';
import BorderedContainer from '../Containers/BorderedContainer';
import { PlusIcon, UploadIcon } from "../Icons/Icons";
import Loading from '../Loading/Loading';
import Text from '../Texts/Text';


const ImageUpload: FC<{ onImageUpload: (image: string) => void, processLoading?: boolean, type?: number }> = ({ onImageUpload, processLoading, type = 1 }) => {

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) {
      const reader = new FileReader();

      reader.onload = (event: ProgressEvent<FileReader>) => {
        const base64 = event.target?.result as string;
        onImageUpload(base64);
      };

      reader.readAsDataURL(file);
    }
  };

  return (
    <>
      {/*Type=1 It is in the input view */}
      {type === 1 && (
        <div className='w-full h-full'>
          <button onClick={handleButtonClick} className="bg-[#74517A] px-2 py-2.5 w-full rounded flex justify-between items-center relative">
            <Text size='base' className="mr-auto">Drop an image or select from your device</Text>
            {processLoading ? <Loading height={16} width={16} className="ml-auto" /> : <UploadIcon />}
          </button>
          <input
            type='file'
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept='image/*'
            style={{ display: 'none' }}
          />
        </div>
      )}
      {type === 2 && (
        <div className='w-full h-full'>
          <button onClick={handleButtonClick} className="border border-white/10 rounded-lg p-3">
            <Text size='sm' className="mr-auto" textColor='text-dark-silver'>Drag and drop an image or select from your device.</Text>
            {processLoading ? <Loading height={36} width={36} /> :

              <BorderedContainer containerClassName='w-12 h-12 mx-auto mt-2' className='flex items-center justify-center'>
                <PlusIcon className="w-4 h-4 text-white" />
              </BorderedContainer>

            }
          </button>
          <input
            type='file'
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept='image/*'
            style={{ display: 'none' }}
          />
        </div>
      )}
    </>
  );
};

export default ImageUpload;