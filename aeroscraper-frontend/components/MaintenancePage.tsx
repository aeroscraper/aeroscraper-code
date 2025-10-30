import React from 'react'
import { BackgroundWave, LogoSecondary } from './Icons/Icons'
import Text from "@/components/Texts/Text"
import Link from 'next/link'

const MaintenancePage = () => {
  return (
    <div className='mx-[85px]'>
      <header className='mb-[88px] mt-8 flex justify-between items-center'>
        <div className='flex items-center gap-2'>
          <LogoSecondary className='w-10 h-10' />
          <Text size='2xl'>Aeroscraper</Text>
        </div>
      </header>

      <div className='flex justify-center'>
        <div className='w-1/3 flex justify-end flex-col ml-80 gap-4'>
          <Text size='5xl' textColor='text-[#E4462D]'>Under Maintenance! Aeroscraper is Getting Updated, Will Be Back Shortly.</Text>
          <Text size='lg' >Aeroscraper is undergoing maintenance for an important update. We are working to provide you with a better experience. Thank you for your patience and support.</Text>
        </div>
      </div>
      <BackgroundWave animate className="absolute bottom-0 left-0 rotate-180 -z-10 md:w-[500px] w-[300px]" />
      <footer className='flex flex-col gap-x-48 gap-y-16 items-top flex-wrap px-20 bg-transparent -mx-20 pr-16 mt-80 pb-24 relative'>
        <div className='grid grid-cols-3 gap-40'>
          <div className='flex flex-col content-start justify-start gap-4'>
            <Text size="sm" textColor='text-white' weight="font-semibold">Product</Text>
            <Link href={'https://novaratio.gitbook.io/aeroscraper/aeroscraper/whitepaper'} target="_blank" rel="noopener noreferrer" className='hover:scale-105 transition-all flex gap-2'>
              <Text size="sm" textColor='text-white' className="cursor-pointer">Whitepaper</Text>
            </Link>
            <Link href={'https://aeroscraper.gitbook.io/aeroscraper/brand-identity/brand-kit'} target="_blank" rel="noopener noreferrer" className='hover:scale-105 transition-all flex gap-2'>
              <Text size="sm" textColor='text-white'>Brand Identity</Text>
            </Link>
            <Link href={'https://testnet.faucet.injective.network/'} target="_blank" rel="noopener noreferrer" className='hover:scale-105 transition-all flex gap-2'>
              <Text size="sm" textColor='text-white'>Injective Faucet</Text>
            </Link>
          </div>
          <div className='flex flex-col content-start justify-start gap-6'>
            <Text size="sm" weight="font-semibold">Deep dive</Text>
            <div className='flex flex-col content-start gap-3'>
              <Link href={'https://aeroscraper.gitbook.io/aeroscraper/definitions-of-aeroscraper/definition-of-name'} target="_blank" rel="noopener noreferrer" className='hover:scale-105 transition-all flex gap-2'>
                <Text size="sm" textColor='text-white'>Definition of name</Text>
              </Link>
              <Link href={'https://aeroscraper.gitbook.io/aeroscraper/definitions-of-aeroscraper/definition-of-icon'} target="_blank" rel="noopener noreferrer" className='hover:scale-105 transition-all flex gap-2'>
                <Text size="sm" textColor='text-white'>Definition of icon</Text>
              </Link>
              <Link href={'https://aeroscraper.gitbook.io/aeroscraper/definitions-of-aeroscraper/definition-of-colors'} target="_blank" rel="noopener noreferrer" className='hover:scale-105 transition-all flex gap-2'>
                <Text size="sm" textColor='text-white'>Definition of colors</Text>
              </Link>
              <Link href={'https://aeroscraper.gitbook.io/aeroscraper/definitions-of-aeroscraper/definition-of-typography'} target="_blank" rel="noopener noreferrer" className='hover:scale-105 transition-all flex gap-2'>
                <Text size="sm" textColor='text-white'>Definition of typography</Text>
              </Link>
              <Link href={'https://aeroscraper.gitbook.io/aeroscraper/'} className='hover:scale-105 transition-all flex gap-2'>
                <Text size="sm" textColor='text-white'>Definition of concept</Text>
              </Link>
            </div>
          </div>
          <div className='flex flex-col content-start justify-start gap-6'>
            <Text size="sm" weight="font-semibold">Social</Text>
            <div className='flex flex-col content-start gap-4'>
              <Link href={'https://twitter.com/aeroscraper'} target="_blank" rel="noopener noreferrer" className='hover:scale-105 transition-all flex gap-2'>
                <Text size="sm" textColor='text-white'>X</Text>
                <img alt='external-link' src='/images/external-link.svg' className='w-4 h-4' />
              </Link>
              <Link href={'https://discord.gg/3R6yTqB8hC'} target="_blank" rel="noopener noreferrer" className='hover:scale-105 transition-all flex gap-2'>
                <Text size="sm" textColor='text-white'>Discord</Text>
                <img alt='external-link' src='/images/external-link.svg' className='w-4 h-4' />
              </Link>
              <Link href={'https://zealy.io/c/aeroscraper/questboard'} target="_blank" rel="noopener noreferrer" className='hover:scale-105 transition-all flex gap-2'>
                <Text size="sm" textColor='text-white'>Zealy</Text>
                <img alt='external-link' src='/images/external-link.svg' className='w-4 h-4' />
              </Link>
              <Link href={'https://medium.com/@aeroscraper'} target="_blank" rel="noopener noreferrer" className='hover:scale-105 transition-all flex gap-2'>
                <Text size="sm" textColor='text-white'>Medium</Text>
                <img alt='external-link' src='/images/external-link.svg' className='w-4 h-4' />
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default MaintenancePage