import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import './App.css';

function App() {
  return (
    <div className='w-screen min-h-screen bg-white text-black flex flex-col'>
      <p className='text-3xl md:text-6xl'>Gnosis Governance Dashboard</p>
      <div className='p-4'>
        <Tabs>
          <div className='w-full flex'>
            <TabList className='flex'>
              <Tab className='px-4 py-2' selectedClassName='font-bold'>
                Overview
              </Tab>
              <Tab className='px-4 py-2' selectedClassName='font-bold'>
                Stats
              </Tab>
            </TabList>
          </div>
          <TabPanel>{/* <GIPTable gips={gips} /> */}</TabPanel>
          <TabPanel>{/* <GIPStats gips={gips} /> */}</TabPanel>
        </Tabs>
      </div>
    </div>
  );
}

export default App;
