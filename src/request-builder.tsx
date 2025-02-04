import { CustomAppContext } from '@kontent-ai/custom-app-sdk';
import { FormEvent, useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import fetchItems from './utils/fetch-items';
import fetchTypes from './utils/fetch-types';
import { IContentType } from '@kontent-ai/delivery-sdk';

interface RequestBuilderProps {
  response: CustomAppContext,
  workbook: XLSX.WorkBook
}

type Config = {
  deliveryKey?: string;
}

export default function RequestBuilder({ response, workbook }: RequestBuilderProps) {
  let environmentId: string;

  const [contentTypes, setContentTypes] = useState<Array<IContentType>>();
  const [apiKey, setAPIKey] = useState<string>('');
  const [validAPIKey, setValidAPIKey] = useState<boolean>(false);
  
  if (response.isError !== true) {
    environmentId = response.context.environmentId;
  }

  async function handleSubmit(event: FormEvent, type: string) {
    event.preventDefault();

    // Resetting sheets in case of existing sheets
    workbook.SheetNames = [];
    workbook.Sheets = {};

    if (type === 'api-key') {
      const keyInput = document.getElementById('api-key') as HTMLInputElement;
      setAPIKey(keyInput.value);
    }
    else {
      const selectedFileTypeInput = document.querySelector('input[name="file-type"]:checked') as HTMLInputElement;
      const checkboxes = document.querySelectorAll('input[type="checkbox"]:checked');
      const selectedWorkflowStep = document.querySelector('input[name="content-workflow-step"]:checked') as HTMLInputElement;
      
      if (checkboxes.length > 0) {
        const types: Array<string>= [];

        checkboxes.forEach((checkbox) => {
          if ((checkbox as HTMLInputElement).value !== 'select-all') types.push((checkbox as HTMLInputElement).value);
        });
  
        let selectedFileType: string = '';
  
        if (selectedFileTypeInput) selectedFileType = selectedFileTypeInput.value;
  
        fetchItems(environmentId, apiKey, types, selectedWorkflowStep.value).then(async (data) => {
          if (data.items.length > 0) {
            const workflowStepError = document.getElementById('workflow-step-error') as HTMLElement;
            if (workflowStepError) workflowStepError.style.display = 'none';

            const itemsValues = data.items.map((item) => Object.entries(item.elements).map(obj => (obj[1].type !== 'modular_content' && obj[1].type !== 'asset' && obj[1].type !== 'taxonomy' && obj[1].type !== 'multiple_choice' ? obj[1].value : (obj[1].type === 'modular_content' ? obj[1].value.join(',') : (obj[1].type === 'asset' ? obj[1].value.map((asset: { url: string; }) => asset.url).join(',') : obj[1].value.map((val: { name: string; }) => val.name).join(','))))));
            const items = data.items.map((item) => Object.entries(item.elements).map(obj => ({ [obj[0]]: obj[1].value })));
    
            let currentType = data.items[0].system.type;
            let currentWorksheet;
            let currentItems = [];
    
            for (let i = 0; i < data.items.length; i++) {
              if (data.items[i].system.type === currentType && i !== data.items.length - 1) {
                currentItems.push(itemsValues[i]);
              }
              else if (data.items[i].system.type === currentType && i === data.items.length - 1) {
                currentItems.push(itemsValues[i]);

                let currentKeys;
    
                // Some of the below logic comes from: https://stackoverflow.com/a/64213063
                if (items.length > 1) currentKeys = [items[i - 1].map(obj => Object.entries(obj)[0][0])];
                else currentKeys = [items[i].map(obj => Object.entries(obj)[0][0])];
                currentWorksheet = XLSX.utils.book_new();
    
                XLSX.utils.sheet_add_aoa(currentWorksheet, currentKeys);
                XLSX.utils.sheet_add_json(currentWorksheet, currentItems, { origin: 'A2', skipHeader: true });
    
                if (currentWorksheet) XLSX.utils.book_append_sheet(workbook, currentWorksheet, currentType);
              }
              else {
                // Some of the below logic comes from: https://stackoverflow.com/a/64213063
                const currentKeys = [items[i - 1].map(obj => Object.entries(obj)[0][0])];
                currentWorksheet = XLSX.utils.book_new();
    
                XLSX.utils.sheet_add_aoa(currentWorksheet, currentKeys);
                XLSX.utils.sheet_add_json(currentWorksheet, currentItems, { origin: 'A2', skipHeader: true });
    
                if (currentWorksheet) XLSX.utils.book_append_sheet(workbook, currentWorksheet, currentType);
    
                currentItems = [];
                currentType = data.items[i].system.type;
                currentItems.push(itemsValues[i]);
              }
            }
            if (selectedFileType === 'excel') {
              XLSX.writeFile(workbook, `${environmentId}-content-export.xlsx`);
            }
            else {
              const zip = new JSZip();
    
              for (const sheetName of workbook.SheetNames) {
                const worksheet = workbook.Sheets[sheetName];
                const csv = XLSX.utils.sheet_to_csv(worksheet);
            
                zip.file(`${sheetName}.csv`, csv);
              }
            
              const zipBlob = await zip.generateAsync({ type: 'blob' });
    
              const downloadLink = document.createElement('a');
              downloadLink.href = URL.createObjectURL(zipBlob);
              downloadLink.download = `${environmentId}-content-export.zip`;
              downloadLink.click();
            }
          }
          else {
            const workflowStepError = document.getElementById('workflow-step-error') as HTMLElement;
            if (workflowStepError) workflowStepError.style.display = 'block';
          }
        })
      }
      else {
        const contentTypeError = document.getElementById('content-type-error');
        if (contentTypeError) contentTypeError.style.display = 'block';
      }
    }
  }

  function handleBackBtn() {
    setValidAPIKey(false);
    setAPIKey('');
    setContentTypes([]);
  }

  useEffect(() => {
    const apiKeyError = document.getElementById('api-key-error') as HTMLElement;
    const workflowStepError = document.getElementById('workflow-step-error') as HTMLElement;
    const contentTypeError = document.getElementById('content-type-error') as HTMLElement;
    const loadingContainer = document.getElementById('loading-container') as HTMLElement;
            
    if (loadingContainer) loadingContainer.style.display = 'flex';
    if (apiKeyError) apiKeyError.style.display = 'none';
    if (workflowStepError) workflowStepError.style.display = 'none';
    if (contentTypeError) contentTypeError.style.display = 'none';

    if (response.isError === false) {
      if (response.config) {
        const config = response.config as Config;
        if (config.deliveryKey) {
          if (contentTypeError) contentTypeError.style.display = 'none';
          const backBtn = document.getElementById('back-btn');
          if (backBtn) backBtn.style.display = 'none';
          setAPIKey(config.deliveryKey);
        }
        else {
          if (loadingContainer) loadingContainer.style.display = 'none';
        }
      }
      else {
        if (loadingContainer) loadingContainer.style.display = 'none';
      }
      fetchTypes(environmentId, apiKey).then(async (response) => {
        if (response === 'error') {
          if (apiKey !== '') {
            if (apiKeyError) apiKeyError.style.display = 'block';
          }
        }
        else {
          if (contentTypeError) contentTypeError.style.display = 'none';
          if (loadingContainer) loadingContainer.style.display = 'none';
          setValidAPIKey(true);
          setContentTypes(response.items);
        }
      })
    }

    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    const selectAllCheckbox = document.getElementById('select-all');

    if (checkboxes.length > 0 && selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', function() {
        for (let i = 0; i < checkboxes.length; i++) {
          (checkboxes[i] as HTMLInputElement).checked = (this as HTMLInputElement).checked;
        }
      });
    }
  }, [response, apiKey, validAPIKey])
  
  return (
    <div className='flex flex-wrap basis-full'>
      {
        validAPIKey === true ?
          <form className='basis-full flex flex-wrap place-content-start divide-y divide-solid divide-gray-300' onSubmit={(e) => handleSubmit(e, 'export')}>
            <fieldset className='basis-full flex flex-wrap mb-6'>
              <div className='basis-full flex mb-3 relative'>
                <legend className='font-bold text-[16px]'>
                  Content types 
                  <span className='tooltip-icon' title='These are the content types of the items that will be exported.'>ⓘ</span>
                </legend>
                <p id='content-type-error' className='hidden absolute bg-(--red) text-white px-2 py-[0.25rem] rounded-lg left-[200px]'>Please select at least one content type to export.</p>
              </div>
              <div className='basis-full flex mb-3'>
                <label htmlFor='select-all' className='input-container flex place-items-center'>
                  <input type='checkbox' className='mr-[8px] accent-(--purple)' id='select-all' value='select-all'/>
                  Select all
                </label>
              </div>
              <div className='pl-8 flex flex-wrap'>
              {
                contentTypes !== null && contentTypes !== undefined  ?
                    contentTypes.map((type, index) =>
                      <div className={`flex basis-full ${index === contentTypes.length - 1 ? 'mb-6' : 'mb-3'}`} key={`${type.system.codename}-container`}>
                        <label htmlFor={type.system.codename} className='input-container flex place-items-center'>
                          <input type='checkbox' className='mr-[8px] accent-(--purple)' id={type.system.codename} value={type.system.codename}/>
                          {type.system.name}
                        </label>
                      </div>
                    )
                : <p>No content types found.</p>
              }
              </div>
            </fieldset>
            <fieldset className='basis-full flex flex-wrap mb-6'>
              <div className='relative basis-full flex mb-3'>
                <legend className='font-bold text-[16px]'>
                  Workflow step
                  <span className='tooltip-icon' title='Be sure to choose a workflow step that your selected content type(s) items are available in. If they are not available, they will not be exported.'>ⓘ</span>
                </legend>
                <p id='workflow-step-error' className='hidden absolute bg-(--red) text-white px-2 py-[0.25rem] rounded-lg left-[125px]'>No items of the selected content type(s) are available in the selected workflow step. Please choose another workflow step or content type(s).</p>
              </div>
              <div className='basis-full flex mb-3'>
                <label htmlFor='published-radio-btn' className='input-container flex place-items-center'>
                  <input type='radio' id='published-radio-btn' className='mr-[8px] accent-(--purple)' name='content-workflow-step' value={'published'} required={true} />
                  Published
                </label>
              </div>
              <div className='basis-full flex mb-3'>
                <label htmlFor='draft-radio-btn' className='input-container flex place-items-center'>
                  <input type='radio' id='draft-radio-btn' className='mr-[8px] accent-(--purple)' name='content-workflow-step' value={'draft'} />
                  Draft
                </label>
              </div>
              <div className='basis-full flex mb-6'>
                <label htmlFor='latest-version-radio-btn' className='input-container flex place-items-center'>
                  <input type='radio' id='latest-version-radio-btn' className='mr-[8px] accent-(--purple)' name='content-workflow-step' value={'latest-version'} />
                  Any (latest version)
                </label>
              </div>
            </fieldset>
            <fieldset className='basis-full flex flex-wrap border-none mb-6'>
              <div className='basis-full flex mb-3'>
                <legend className='font-bold text-[16px]'>
                  File type
                  <span className='tooltip-icon' title='If you choose Excel, then your selected content types will be organized into their own worksheets and exported within a single spreadsheet. If you choose CSV, then your selected content types will be contained within their own CSV files, and exported together as a ZIP file.'>ⓘ</span>
                </legend>
              </div>
              <div className='basis-full flex mb-3'>
                <label htmlFor='excel-radio-btn' className='input-container flex place-items-center'>
                  <input type='radio' id='excel-radio-btn' className='mr-[8px] accent-(--purple)' name='file-type' value={'excel'} required={true} />
                  Excel
                </label>
              </div>
              <div className='basis-full flex mb-6'>
                <label htmlFor='csv-radio-btn' className='input-container flex place-items-center'>
                  <input type='radio' id='csv-radio-btn' className='mr-[8px] accent-(--purple)' name='file-type' value={'csv'} />
                  CSV
                </label>
              </div>
            </fieldset>
            <div className='justify-self-end h-[60px] basis-full flex place-items-end justify-between'>
              <button id='back-btn' type='button' className='btn back-btn' onClick={() => handleBackBtn()}>Back</button>
              <button type='submit' className='btn continue-btn'>Export content</button>
            </div>
          </form>
          :
          <form onSubmit={(e) => handleSubmit(e, 'api-key')} className='basis-full flex flex-wrap place-content-start'>
            <div id='loading-container' className='basis-full fixed bg-white z-10 top-0 bottom-0 left-0 right-0 flex place-items-center'>
              <div className='basis-full flex flex-wrap'>
                <div className='basis-full flex place-content-center'>
                  <span id='loading-span' className='text-6xl'></span>
                </div>
              </div>
            </div>
            <div className='relative basis-full flex flex-wrap place-items-start mb-12'>
              <label id='api-key-label' htmlFor='api-key' className='basis-full text-left mb-3 font-bold focus:border-color-(--orange)'>Delivery Preview API key</label>
              <input type='text' id='api-key' name='api-key' required={true}/>
              <p id='api-key-error' className='hidden absolute bg-(--red) text-white px-2 py-[0.25rem] rounded-lg top-[5.5rem]'>Please make sure the API key is valid in your current environment.</p>
            </div>
            <div className='justify-self-end h-[60px] basis-full text-right'>
              <button type='submit' className='btn continue-btn place-self-end'>Continue</button>
            </div>
          </form>
      }
    </div>
  )
}