import { useEffect, useState } from 'react';
import './App.css';
import { getCustomAppContext, CustomAppContext } from '@kontent-ai/custom-app-sdk';
import RequestBuilder from './request-builder';
import * as XLSX from 'xlsx';

export default function App() {
  const workbook = XLSX.utils.book_new();
  const [response, setResponse] = useState<CustomAppContext>({
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
    config: ''
  });

  async function getContext() {
    const currentResponse = await getCustomAppContext();

    if (currentResponse.isError) {
      console.error({ errorCode: currentResponse.code, description: currentResponse.description});
    } 
    else {
      setResponse({...currentResponse});
    }
  };

  useEffect(() => {
    getContext();
  }, []);
  
  return (
    <div className='flex flex-wrap my-0 mx-auto'>
      <p id='app-title' className='absolute top-0 right-0 left-0 py-4 pl-[3rem] text-[16px] text-left text-white'>Content export tool</p>
      {
        response.isError === false ?
          <RequestBuilder response={response} workbook={workbook} />
          :
          <div>
            <strong>{response.code}: </strong>
            <span>{response.description}</span>
          </div>
        }
    </div>
  );
}