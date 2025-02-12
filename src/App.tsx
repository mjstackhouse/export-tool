import { useEffect, useState } from 'react';
import './App.css';
import RequestBuilder from './request-builder';
import * as XLSX from 'xlsx';

let customAppSDK: any = null;

export default function App() {
  const workbook = XLSX.utils.book_new();
  const [response, setResponse] = useState<any>({
    isError: false,
    context: {
        environmentId: '',
        userId: '',
        userEmail: '',
        userRoles: [{
            id: '',
            codename: '',
        }]
    },
    config: 'unavailable'
  });

  async function getContext() {
    let currentResponse;

    if (customAppSDK !== null) {
      currentResponse = await customAppSDK.getCustomAppContext();

      if (await currentResponse.isError) {
        console.error({ errorCode: currentResponse.code, description: currentResponse.description});
      } 
      else {
        setResponse({...currentResponse});
      }
    }
  };

  useEffect(() => {
    async function loadSDK() {
      if (window.self !== window.top) {
        try {
          customAppSDK = await import('@kontent-ai/custom-app-sdk');
          if (customAppSDK !== null) getContext();
        }
        catch (error) {
          console.error(error);
        }
      }
      else {
        console.log('Running outside of Kontent.ai, SDK not loaded');
      }
    }

    loadSDK();
  }, []);
  
  return (
    <div className='flex flex-wrap my-0 mx-auto'>
      <p id='app-title' className='absolute top-0 right-0 left-0 py-4 pl-[3rem] text-[16px] text-left text-white'>Content export tool</p>
      {
        response.isError === false ?
          <RequestBuilder contextResponse={response} workbook={workbook} />
          :
          <div>
            <strong>{response.code}: </strong>
            <span>{response.description}</span>
          </div>
        }
    </div>
  );
}