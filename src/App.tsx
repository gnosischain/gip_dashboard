import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import './App.css';
import { useEffect, useState } from 'react';
import yaml from 'js-yaml';
import GIPTable from './components/GIPTable';
import GIPStats from './components/GIPStats';

export interface GIP {
  author: string;
  body: string;
  choices: 'For' | 'Against' | 'Abstain';
  end: number;
  funding:
    | {
        amount: string;
        currency: string;
      }
    | undefined;
  gip_number: string;
  id: string;
  quorum: number;
  scores: number[];
  scores_state: string;
  scores_total: number;
  start: number;
  state: string;
  title: string;
  url: string;
  votes: number;
}

function App() {
  const [gips, setGips] = useState<GIP[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const loadGIPs = async () => {
    try {
      const gipFiles = Array.from(
        { length: 1000 },
        (_, i) => `GIP-${i + 1}.yml`
      );
      const fetchPromises = gipFiles.map((file) =>
        fetch(`../GIPs/${file}`)
          .then((response) => {
            if (!response.ok) {
              console.warn(`Error fetching ${file}: ${response.statusText}`);
              return null;
            }
            return response.text();
          })
          .catch((error) => {
            console.error(`Fetch failed for ${file}:`, error);
            return null;
          })
      );
      const fileContents = await Promise.all(fetchPromises);

      const parsedGips = fileContents
        .filter((content): content is string => {
          if (!content || content.startsWith('<!doctype html>')) {
            console.warn(
              'Invalid file content, skipping:',
              content?.slice(0, 100)
            );
            return false;
          }
          return true;
        })
        .map((content) => {
          try {
            return yaml.load(content) as GIP;
          } catch (e) {
            console.error('Error parsing YAML:', e);
            return null;
          }
        })
        .filter((gip): gip is GIP => gip !== null);

      setGips(parsedGips);
      console.log('Parsed GIPs:', parsedGips);
    } catch (error) {
      console.error('Error loading GIPs:', error);
    }
  };

  useEffect(() => {
    loadGIPs();
  }, []);
  return (
    <div className='z-50 w-full min-h-screen bg-white text-black flex flex-col md:pl-[60px] pt-[100px] md:pt-[120px]'>
      <p className='flex text-3xl md:text-[56px] max-sm:pl-[16px]'>Gnosis Governance Dashboard</p>
      <p className='pl-[40px] md:pl-[60px] mt-6 md:mt-8'>
        Gnosis Improvement Proposals (GIPs) describe network upgrades for Gnosis
        Chain, funding requests and allocations from the GnosisDAO treasury to
        support the Gnosis ecosystem and GnosisDAO meta governance
        specifications.
      </p>
      <div className='max-sm:px-4 md:pl-[60px] mt-10 md:mt-20'>
        <Tabs>
          <div className='w-full bg-white flex justify-between sticky top-0 py-2'>
            <TabList className='flex gap-x-2 text-black/60'>
              <Tab className='p-0' selectedClassName='bg-black text-white'>
                Overview
              </Tab>
              <Tab className='p-0' selectedClassName='bg-black text-white'>
                Stats
              </Tab>
            </TabList>
            <div>
              <input
                type='text'
                value={searchTerm}
                placeholder='Search'
                onChange={(e) => setSearchTerm(e.target.value)}
                className='underline focus:outline-none w-44 bg-gray-100 px-1 md:mr-2'
              />
            </div>
          </div>
          <div className='w-full md:pl-8 mt-8'>
            <TabPanel>
              <GIPTable gips={gips} searchTerm={searchTerm} />
            </TabPanel>
            <TabPanel>
              <GIPStats gips={gips} />
            </TabPanel>
          </div>
        </Tabs>
      </div>
    </div>
  );
}

export default App;
