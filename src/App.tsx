import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import './App.css';
import { useEffect, useState } from 'react';
// import GIPTable from './components/GIPTable';
import yaml from 'js-yaml';
import GIPTable from './components/GIPTable';

export interface GIP {
  author: string,
  body: string,
  choices: "For" | "Against" | "Abstain",
  end: number,
  funding: {
    amount: string,
    currency: string,
  } | undefined,
  gip_number: string,
  id: string,
  quorum: number,
  scores: number[],
  scores_state: string,
  scores_total: number,
  start: number,
  state: string,
  title: string;
  url: string,
  votes: number
}

function App() {
  const [gips, setGips] = useState<GIP[]>([]);

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
            console.warn('Invalid file content, skipping:', content?.slice(0, 100));
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
    <div className='w-screen min-h-screen bg-white text-black flex flex-col'>
      <p className='text-3xl md:text-6xl'>Gnosis Governance Dashboard</p>
      <div className='p-4'>
        <Tabs>
          <div className='w-full flex justify-between'>
            <TabList className='flex gap-x-2 text-black/60'>
              <Tab className='p-0' selectedClassName='bg-black text-white'>
                Overview
              </Tab>
              <Tab className='p-0' selectedClassName='bg-black text-white'>
                Stats
              </Tab>
            </TabList>
            <div>Search Component Here</div>
          </div>
          <TabPanel>{<GIPTable gips={gips} />}</TabPanel>
          <TabPanel>{/* <GIPStats gips={gips} /> */}</TabPanel>
        </Tabs>
      </div>
    </div>
  );
}

export default App;