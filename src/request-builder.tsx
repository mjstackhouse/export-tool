import { CustomAppContext } from '@kontent-ai/custom-app-sdk';
import { FormEvent, useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import fetchItems from './utils/fetch-items';
import fetchTypes from './utils/fetch-types';
import { IContentType, ILanguage } from '@kontent-ai/delivery-sdk';
import fetchLanguages from './utils/fetch-languages';
import secureAccessTest from './utils/secure-access-test';
import previewTest from './utils/preview-test';

interface RequestBuilderProps {
  contextResponse?: CustomAppContext,
  workbook: XLSX.WorkBook
}

type Config = {
  deliveryKey?: string;
}

export default function RequestBuilder({ contextResponse, workbook }: RequestBuilderProps) {
  const filteringOperators = ['equals', 'does not equal', 'is before', 'is before or the same as', 'is after', 'is after or the same as', 'is in the range of'];

  const [insideKontentAi, setInsideKontentAi] = useState<boolean>(false);
  const [environmentId, setEnvironmentId] = useState<string>('');
  const [apiKey, setAPIKey] = useState<string>('');
  const [apiKeyErrorText, setAPIKeyErrorText] = useState<string>('');
  const [contentTypes, setContentTypes] = useState<Array<IContentType>>();
  const [languages, setLanguages] = useState<Array<ILanguage>>();
  const [loadingText, setLoadingText] = useState<string>('Checking custom app configuration...');
  const [exportBtnText, setExportBtnText] = useState<string>('Export content');
  const [backBtnText, setBackBtnText] = useState<string>('Change API key');
  const [validAPIKey, setValidAPIKey] = useState<boolean>(false);
  const [validConfigAPIKey, setValidConfigAPIKey] = useState<boolean>(false);

  async function handleSubmit(event: FormEvent, type: string) {
    event.preventDefault();

    const apiKeyError = document.getElementById('api-key-error') as HTMLElement;
    const noItemsError = document.getElementById('no-items-error') as HTMLElement;
    const contentTypeError = document.getElementById('content-type-error') as HTMLElement;
    const languageError = document.getElementById('language-error') as HTMLElement;
    const workflowStepError = document.getElementById('workflow-step-error') as HTMLElement;
    const fileTypeError = document.getElementById('file-type-error') as HTMLElement;

    workbook.SheetNames = [];
    workbook.Sheets.length = {};
    if (workbook.Props) workbook.Props.SheetNames = [];

    if (type === 'api-key') {
      const environmentIdInput = document.getElementById('environment-id') as HTMLInputElement;
      const keyInput = document.getElementById('api-key') as HTMLInputElement;

      if (environmentIdInput !== null) {
        setEnvironmentId(environmentIdInput.value);
      }
      setAPIKey(keyInput.value.trim());
      setLoadingText('Validating your API key...');
    }
    else {
      const selectedTypes = document.querySelectorAll('input[type="checkbox"]:checked');
      const selectedLanguage = document.querySelector('input[name="language"]:checked') as HTMLInputElement;
      const selectedWorkflowStep = document.querySelector('input[name="content-workflow-step"]:checked') as HTMLInputElement;
      const selectedFileTypeInput = document.querySelector('input[name="file-type"]:checked') as HTMLInputElement;
      
      const itemName = (document.getElementById('item-name') as HTMLInputElement).value.trim();
      const collection = (document.getElementById('collection') as HTMLInputElement).value.trim();
      
      const selectedLastModifiedOperator = document.getElementById('last-modified-filtering-operator') as HTMLSelectElement;
      let lastModified = [];

      // Setting lastModified value
      if (selectedLastModifiedOperator) {
        if (selectedLastModifiedOperator.value !== filteringOperators[filteringOperators.length - 1]) {
          const lastModifiedInput = document.getElementById('last-modified') as HTMLInputElement;
          if (lastModifiedInput) lastModified[0] = lastModifiedInput.value;
        }
        else {
          const lastModifiedInput = document.getElementById('last-modified') as HTMLInputElement;
          if (lastModifiedInput) lastModified[0] = lastModifiedInput.value;

          const lastModifiedInputRange = document.getElementById('last-modified-range') as HTMLInputElement;
          if (lastModifiedInputRange) lastModified[1] = lastModifiedInputRange.value;
        }
      }

      // Checking for missing values and displaying or hiding errors
      if (selectedTypes.length === 0 || !selectedLanguage || !selectedWorkflowStep || !selectedFileTypeInput) {
        const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

        if (!selectedFileTypeInput) {
          if (fileTypeError) fileTypeError.style.display = 'block';
          fileTypeError.scrollIntoView({ behavior: prefersReducedMotion.matches ? 'instant' : 'smooth', block: 'start', inline: 'start' });
        }
        else {
          if (fileTypeError) fileTypeError.style.display = 'none';
        }

        if (!selectedWorkflowStep) {
          if (workflowStepError) workflowStepError.style.display = 'block';
          workflowStepError.scrollIntoView({ behavior: prefersReducedMotion.matches ? 'instant' : 'smooth', block: 'start', inline: 'start' });
        }
        else {
          if (workflowStepError) workflowStepError.style.display = 'none';
        }

        if (!selectedLanguage) {
          if (languageError) languageError.style.display = 'block';
          languageError.scrollIntoView({ behavior: prefersReducedMotion.matches ? 'instant' : 'smooth', block: 'start', inline: 'start' });
        }
        else {
          if (languageError) languageError.style.display = 'none';
        }

        if (selectedTypes.length === 0) {
          if (contentTypeError) contentTypeError.style.display = 'block';
          contentTypeError.scrollIntoView({ behavior: prefersReducedMotion.matches ? 'instant' : 'smooth', block: 'start', inline: 'start' });
        }
        else {
          if (contentTypeError) contentTypeError.style.display = 'none';
        }
      }
      else {
        if (apiKeyError) apiKeyError.style.display = 'none';
        if (noItemsError) noItemsError.style.display = 'none';
        if (contentTypeError) contentTypeError.style.display = 'none';
        if (languageError) languageError.style.display = 'none';
        if (workflowStepError) workflowStepError.style.display = 'none';
        if (fileTypeError) fileTypeError.style.display = 'none';

        setExportBtnText('Exporting content')

        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) exportBtn.setAttribute('disabled', '');

        const loadingExportSpinner = document.getElementById('loading-export') as HTMLElement;
        if (loadingExportSpinner) loadingExportSpinner.style.display = 'inline-block';

        const types: Array<string>= [];

        selectedTypes.forEach((checkbox) => {
          if ((checkbox as HTMLInputElement).value !== 'select-all') types.push((checkbox as HTMLInputElement).value);
        });
  
        let selectedFileType: string = '';
  
        if (selectedFileTypeInput) selectedFileType = selectedFileTypeInput.value;
  
        fetchItems(environmentId, apiKey, types, selectedLanguage.value, selectedWorkflowStep.value, { value: lastModified, filter: selectedLastModifiedOperator.value }, itemName, collection).then(async (data) => {
          if (data.items.length > 0) {
            const noItemsError = document.getElementById('no-items-error') as HTMLElement;
            if (noItemsError) noItemsError.style.display = 'none';

            const itemsValues = data.items.map((item) => Object.entries(item.elements).map(obj => (obj[1].type !== 'modular_content' && obj[1].type !== 'asset' && obj[1].type !== 'taxonomy' && obj[1].type !== 'multiple_choice' ? obj[1].value : (obj[1].type === 'modular_content' ? obj[1].value.join(',') : (obj[1].type === 'asset' ? obj[1].value.map((asset: { url: string; }) => asset.url).join(',') : obj[1].value.map((val: { name: string; }) => val.name).join(','))))));
            const items = data.items.map((item) => Object.entries(item.elements).map(obj => ({ [obj[1].name]: obj[1].value })));
    
            let currentType = data.items[0].system.type;
            let currentWorksheet;
            let currentItems = [];
    
            for (let i = 0; i < data.items.length; i++) {
              if (data.items[i].system.type === currentType && i !== data.items.length - 1) {
                currentItems.push(itemsValues[i]);
              }
              // The final item is not the only of its type
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
              // The final item is the only of its type
              else if (data.items[i].system.type !== currentType && i === data.items.length - 1) {
                let currentKeys = [items[i - 1].map(obj => Object.entries(obj)[0][0])];
                currentWorksheet = XLSX.utils.book_new();
    
                XLSX.utils.sheet_add_aoa(currentWorksheet, currentKeys);
                XLSX.utils.sheet_add_json(currentWorksheet, currentItems, { origin: 'A2', skipHeader: true });
    
                if (currentWorksheet) XLSX.utils.book_append_sheet(workbook, currentWorksheet, currentType);

                // Now handling the final item/type
                currentItems = [];
                currentItems.push(itemsValues[i]);
    
                currentKeys = [items[i].map(obj => Object.entries(obj)[0][0])];
                currentWorksheet = XLSX.utils.book_new();
    
                XLSX.utils.sheet_add_aoa(currentWorksheet, currentKeys);
                XLSX.utils.sheet_add_json(currentWorksheet, currentItems, { origin: 'A2', skipHeader: true });
    
                if (currentWorksheet) XLSX.utils.book_append_sheet(workbook, currentWorksheet, data.items[i].system.type);
              }
              else {
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
              XLSX.writeFile(workbook, `${environmentId}-export.xlsx`);
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
              downloadLink.download = `${environmentId}-export.zip`;
              downloadLink.click();
            }
          }
          else {
            const noItemsError = document.getElementById('no-items-error') as HTMLElement;
            if (noItemsError) noItemsError.style.display = 'block';
          }

          setExportBtnText('Export content')
          if (exportBtn) exportBtn.removeAttribute('disabled');
          if (loadingExportSpinner) loadingExportSpinner.style.display = 'none';
        })
      }
    }
  }

  function handleBackBtn() {
    setValidAPIKey(false);
    setAPIKey('');
    setContentTypes([]);
    setLanguages([]);
  }

  function handleRange(operatorType: string) {
    const lastModifiedRange = document.getElementById('last-modified-range-container');

    if (operatorType === 'not range') {
      if (lastModifiedRange) lastModifiedRange.style.display = 'none';
    }
    else {
      if (lastModifiedRange) lastModifiedRange.style.display = 'flex';
    }
  }

  useEffect(() => {
    const apiKeyError = document.getElementById('api-key-error') as HTMLElement;
    const noItemsError = document.getElementById('no-items-error') as HTMLElement;
    const contentTypeError = document.getElementById('content-type-error') as HTMLElement;
    const languageError = document.getElementById('language-error') as HTMLElement;
    const workflowStepError = document.getElementById('workflow-step-error') as HTMLElement;
    const fileTypeError = document.getElementById('file-type-error') as HTMLElement;
    const loadingContainer = document.getElementById('loading-container') as HTMLElement;
    const loadingExportSpinner = document.getElementById('loading-export') as HTMLElement;

    if (loadingExportSpinner) loadingExportSpinner.style.display = 'none';    
    if (loadingContainer) loadingContainer.style.display = 'flex';
    if (apiKeyError) apiKeyError.style.display = 'none';
    if (noItemsError) noItemsError.style.display = 'none';
    if (contentTypeError) contentTypeError.style.display = 'none';
    if (languageError) languageError.style.display = 'none';
    if (workflowStepError) workflowStepError.style.display = 'none';
    if (fileTypeError) fileTypeError.style.display = 'none';

    if (contentTypes !== undefined && languages !== undefined) {
      if (loadingContainer) loadingContainer.style.display = 'none';
    }

    // Inside of Kontent.ai
    if (contextResponse) {
      if (contextResponse.isError !== true && contextResponse.context.environmentId !== '') {
        setInsideKontentAi(true);
        setEnvironmentId(contextResponse.context.environmentId);
        setBackBtnText('Change API key');
      }
      else {
        if (loadingContainer) loadingContainer.style.display = 'none';
        setInsideKontentAi(false);
        setBackBtnText('Change settings');
      }

      if (contextResponse.isError === false && contextResponse.context.environmentId !== '') {
        if (contextResponse.config !== 'unavailable' && contextResponse.config !== null) {
          const config = contextResponse.config as Config;
  
          if (config.deliveryKey && apiKey === '') {
            setAPIKey(config.deliveryKey.trim());
          }
        }
        else if (contextResponse.config === null) {
          if (loadingContainer) loadingContainer.style.display = 'none';
        }
  
        if (validConfigAPIKey === true) {
          if (contentTypeError) contentTypeError.style.display = 'none';
          const backBtn = document.getElementById('back-btn');
          if (backBtn) backBtn.style.display = 'none';
        }
  
        if (apiKey !== '') {
          if (loadingContainer) {
            if (loadingContainer.style.display === 'none') loadingContainer.style.display = 'flex';
          }
  
          secureAccessTest(environmentId, apiKey).then(async (response) => {
            if (typeof response === 'string') {
              if (loadingContainer) loadingContainer.style.display = 'none';
              if (apiKeyError) apiKeyError.style.display = 'block';
              if (contextResponse.config) {
                if ((contextResponse.config as Config).deliveryKey) {
                  setValidConfigAPIKey(false);
                  setAPIKeyErrorText("Missing or invalid key. Please adjust the custom app's configuration, or input a valid key above.");
                } 
              }
              else setAPIKeyErrorText("Invalid key. Please make sure your key has 'Secure access' enabled.");
            }
            else {
              previewTest(environmentId, apiKey).then(async (response) => {
                if (typeof response === 'string') {
                  if (loadingContainer) loadingContainer.style.display = 'none';
                  if (apiKeyError) apiKeyError.style.display = 'block';
                  if (contextResponse.config) {
                    if ((contextResponse.config as Config).deliveryKey) {
                      setValidConfigAPIKey(false);
                      setAPIKeyErrorText("Missing or invalid key. Please adjust the custom app's configuration, or input a valid key above.");
                    }
                  }
                  else setAPIKeyErrorText("Invalid key. Please make sure your key has 'Content preview' enabled.");
                }
                else {
                  if (contextResponse.config) {
                    if ((contextResponse.config as Config).deliveryKey) setValidConfigAPIKey(true);
                  }
  
                  setLoadingText('Fetching content types...');
  
                  fetchTypes(environmentId, apiKey).then(async (response) => {
                    if (response === 'error') {
                      if (loadingContainer) loadingContainer.style.display = 'none';
                      if (apiKeyError) apiKeyError.style.display = 'block';
                    }
                    else if (response.items.length === 0) {
                      if (loadingContainer) loadingContainer.style.display = 'none';
                      if (apiKeyError) apiKeyError.style.display = 'block';
                      setAPIKeyErrorText('Please make sure your environment has content types to export.');
                    }
                    else {
                      setValidAPIKey(true);
  
                      if (contentTypeError) contentTypeError.style.display = 'none';
  
                      setContentTypes(response.items);
                      setLoadingText('Fetching languages...');
  
                      fetchLanguages(environmentId, apiKey).then(async (response) => {
                        if (response === 'error') {
                          if (loadingContainer) loadingContainer.style.display = 'none';
                          if (apiKeyError) apiKeyError.style.display = 'block';
                        }
                        else {
                          setLanguages(response.items);
                          if (contentTypeError) contentTypeError.style.display = 'none';
                          if (loadingContainer) loadingContainer.style.display = 'none';
                        }
                      })
                    }
                  })
                }
              })
            }
          })
        }
      }
      // Outside of Kontent.ai
      else {
        if (apiKey !== '' && environmentId !== '') {
          if (loadingContainer) {
            if (loadingContainer.style.display === 'none') loadingContainer.style.display = 'flex';
          }

          secureAccessTest(environmentId, apiKey).then(async (response) => {
            if (typeof response === 'string') {
              setAPIKeyErrorText("Invalid key. Please make sure your key has 'Secure access' enabled.");
              if (loadingContainer) loadingContainer.style.display = 'none';
              if (apiKeyError) apiKeyError.style.display = 'block';
            }
            else {
              previewTest(environmentId, apiKey).then(async (response) => {
                if (typeof response === 'string') {
                  setAPIKeyErrorText("Invalid key. Please make sure your key has 'Content preview' enabled.");
                  if (loadingContainer) loadingContainer.style.display = 'none';
                  if (apiKeyError) apiKeyError.style.display = 'block';
                }
                else {
                  setLoadingText('Fetching content types...');

                  fetchTypes(environmentId, apiKey).then(async (response) => {
                    if (response === 'error') {
                      if (loadingContainer) loadingContainer.style.display = 'none';
                      if (apiKeyError) apiKeyError.style.display = 'block';
                    }
                    else if (response.items.length === 0) {
                      if (loadingContainer) loadingContainer.style.display = 'none';
                      if (apiKeyError) apiKeyError.style.display = 'block';
                      setAPIKeyErrorText('Please make sure your environment has content types to export.');
                    }
                    else {
                      setValidAPIKey(true);

                      if (contentTypeError) contentTypeError.style.display = 'none';

                      setContentTypes(response.items);
                      setLoadingText('Fetching languages...');

                      fetchLanguages(environmentId, apiKey).then(async (response) => {
                        if (response === 'error') {
                          if (loadingContainer) loadingContainer.style.display = 'none';
                          if (apiKeyError) apiKeyError.style.display = 'block';
                        }
                        else {
                          setLanguages(response.items);
                          if (contentTypeError) contentTypeError.style.display = 'none';
                          if (loadingContainer) loadingContainer.style.display = 'none';
                        }
                      })
                    }
                  })
                }
              })
            }
          })
        }
      }
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
  }, [contextResponse, apiKey, validAPIKey])
  
  return (
    <div className='flex flex-wrap basis-full'>
      <div id='loading-container' className='basis-full fixed bg-white z-10 top-0 bottom-0 left-0 right-0 flex place-items-center'>
        <div className='basis-full flex flex-wrap'>
          <div className='basis-full flex flex-wrap place-content-center'>
            <div id='loading-general-text' className='basis-full mb-3'>{loadingText}</div>
            <span id='loading-general' className='loading-span text-6xl'></span>
          </div>
        </div>
      </div>
      {
        validAPIKey === true ?
          <form className='basis-full relative flex flex-wrap place-content-start divide-y divide-solid divide-gray-300' onSubmit={(e) => handleSubmit(e, 'export')}>
            
            <p id='no-items-error' className='hidden fixed bg-(--red) text-white px-2 py-[0.25rem] rounded-lg top-[72px] inset-x-[25%] z-10'>
              No items are available with the selected filters. Please change your selected filters.
            </p>
            <fieldset className='basis-full flex flex-wrap'>
              <details className='basis-full flex flex-wrap' open>
                <summary className='basis-full'>
                  <div className='relative'>
                    <legend className='font-bold text-[16px] text-left'>
                      Content types
                      <span className='tooltip-icon' title='These are the content types of the items that will be exported.'>ⓘ</span>
                    </legend>
                    <p id='content-type-error' className='hidden absolute bg-(--red) text-white px-2 py-[0.25rem] rounded-lg left-[165px] top-0'>
                      Please select at least one content type.
                    </p>
                  </div>
                </summary>
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
              </details>
            </fieldset>
            <fieldset className='basis-full flex flex-wrap'>
              <details className='basis-full flex flex-wrap' open>
                <summary className='basis-full'>
                  <div className='relative'>
                    <legend className='font-bold text-[16px] text-left'>
                      Language
                      <span className='tooltip-icon' title='These are the languages your content items can be exported in.'>ⓘ</span>
                    </legend>
                    <p id='language-error' className='hidden absolute bg-(--red) text-white px-2 py-[0.25rem] rounded-lg left-[165px] top-0'>
                      Please select a language.
                    </p>
                  </div>
                </summary>
                <div className='flex flex-wrap'>
                {
                  languages !== null && languages !== undefined  ?
                      languages.map((lang, index) =>
                        <div className={`flex basis-full ${index === languages.length - 1 ? 'mb-6' : 'mb-3'}`} key={`${lang.system.codename}-container`}>
                          <label htmlFor={lang.system.codename} className='input-container flex place-items-center'>
                            <input type='radio' name='language' className='mr-[8px] accent-(--purple)' id={lang.system.codename} value={lang.system.codename} />
                            {lang.system.name}
                          </label>
                        </div>
                      )
                  : <p>No languages found.</p>
                }
                </div>
              </details>
            </fieldset>
            <fieldset className='basis-full flex flex-wrap'>
              <details className='basis-full flex flex-wrap' open>
                <summary className='basis-full'>
                  <div className='relative'>
                    <legend className='font-bold text-[16px] text-left'>
                        Workflow step
                      <span className='tooltip-icon' title='Be sure to choose a workflow step that your selected content type(s) items are available in. If they are not available, they will not be exported.'>
                        ⓘ
                      </span>
                    </legend>
                    <p id='workflow-step-error' className='hidden absolute bg-(--red) text-white px-2 py-[0.25rem] rounded-lg left-[165px] top-0'>
                      Please select a workflow step.
                    </p>
                  </div>
                </summary>
                <div className='basis-full flex mb-3'>
                  <label htmlFor='latest-version-radio-btn' className='input-container flex place-items-center'>
                    <input type='radio' id='latest-version-radio-btn' className='mr-[8px] accent-(--purple)' name='content-workflow-step' value={'latest-version'} />
                    Any (latest version)
                  </label>
                </div>
                <div className='basis-full flex mb-3'>
                  <label htmlFor='published-radio-btn' className='input-container flex place-items-center'>
                    <input type='radio' id='published-radio-btn' className='mr-[8px] accent-(--purple)' name='content-workflow-step' value={'published'} />
                    Published
                  </label>
                </div>
                <div className='basis-full flex mb-6'>
                  <label htmlFor='draft-radio-btn' className='input-container flex place-items-center'>
                    <input type='radio' id='draft-radio-btn' className='mr-[8px] accent-(--purple)' name='content-workflow-step' value={'draft'} />
                    Draft
                  </label>
                </div>
              </details>
            </fieldset>
            <fieldset className='basis-full flex flex-wrap mb-6'>
              <details className='basis-full'>
                <summary>
                  <div className='relative basis-full'>
                    <legend className='font-bold text-[16px] text-left'>
                      Optional filters
                      <span className='tooltip-icon' title='These filters will apply to your entire search, regardless of content type.'>ⓘ</span>
                    </legend>
                  </div>
                </summary>
              <div id='item-name-container' className='flex flex-wrap mb-3'>
                <label htmlFor='item-name' className='basis-full flex place-items-center mb-1.5'>
                  Item name
                </label>
                <input id='item-name' type='text' className='basis-full mb-3' />
              </div>
              <div id='collection-container' className='flex flex-wrap mb-3'>
                <label htmlFor='collection' className='basis-full flex place-items-center mb-1.5'>
                  Collection
                  <span className='tooltip-icon-small' title="This requires the collection's codename. It can be found under 'Environment settings' -> 'Collections', and then by clicking on the {#} button from the right side of the collection's name.">ⓘ</span>
                </label>
                <input id='collection' type='text' className='basis-full mb-3' placeholder="Collection codename" />
              </div>
              <div id='last-modified-container' className='flex flex-wrap mb-6'>
                <label htmlFor='last-modified' className='basis-full flex place-items-center mb-1.5'>
                  Last modified date
                </label>
                <select id='last-modified-filtering-operator' name='last-modified-filtering-operator' className='basis-full mb-3' onChange={(e) => e.target.value === filteringOperators[filteringOperators.length - 1] ? handleRange('range') : handleRange('not range')}>
                  {
                    filteringOperators.map((operator) =>
                      operator !== 'equals' && operator !== 'does not equal' ?
                        <option value={operator} key={`${operator}-key`}>{operator}</option>
                      :
                      null
                    )
                  }
                </select>
                <input id='last-modified' type='date' className='basis-full mb-3' />
                <div id='last-modified-range-container' className='basis-full hidden flex-wrap'>
                  <p className='basis-full text-left mb-1.5 py-[0.25rem] px-[0.5rem] text-[14px]'>and</p>
                  <input id='last-modified-range' type='date' className='basis-full mb-3' />
                </div>
              </div>
              </details>
            </fieldset>
            <fieldset className='basis-full flex flex-wrap border-none'>
              <div className='basis-full flex mb-3 relative'>
                <legend className='font-bold text-[16px]'>
                  File type
                  <span className='tooltip-icon' title='If you choose Excel, then your selected content types will be organized into their own worksheets and exported within a single workbook. If you choose CSV, then your selected content types will be contained within their own CSV files, and exported together as a ZIP file.'>ⓘ</span>
                </legend>
                <p id='file-type-error' className='hidden absolute bg-(--red) text-white px-2 py-[0.25rem] rounded-lg left-[191.391px] top-0'>
                  Please select a file type.
                </p>
              </div>
              <div className='basis-full flex mb-3'>
                <label htmlFor='excel-radio-btn' className='input-container flex place-items-center'>
                  <input type='radio' id='excel-radio-btn' className='mr-[8px] accent-(--purple)' name='file-type' value={'excel'} />
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
              <button id='back-btn' type='button' className='btn back-btn' onClick={() => handleBackBtn()}>{backBtnText}</button>
              <button id='export-btn' type='submit' className='btn continue-btn flex place-items-center'>
                <span id='loading-export' className='hidden loading-span'></span>
                {exportBtnText}
              </button>
            </div>
          </form>
          :
          <form onSubmit={(e) => handleSubmit(e, 'api-key')} className='basis-full flex flex-wrap place-content-start'>
            <div className='relative basis-full flex flex-wrap place-items-start mb-12'>
              {
                insideKontentAi === false ?
                <div className='basis-full relative flex flex-wrap mb-6'>
                  <label id='environment-id-label' htmlFor='environment-id' className='basis-full text-left mb-3 font-bold focus:border-color-(--orange)'>
                    Environment ID
                  <span className='tooltip-icon' title="The environment ID of the environment you would like to export content from. This can be found under 'Environment settings', or as the value in the URL as shown: app.kontent.ai/<environment-id>.">ⓘ</span>
                  </label>
                  <input type='text' id='environment-id' name='environment-id' required={true}/>
                </div>
                :
                null
              }
              <div className='basis-full relative flex flex-wrap'>
                <label id='api-key-label' htmlFor='api-key' className='basis-full text-left mb-3 font-bold focus:border-color-(--orange)'>
                  Delivery Preview API key
                  <span className='tooltip-icon' title='Your key must have Content Preview enabled. If your environment has Secure Access enabled, then your key must have Secure Access enabled as well.'>ⓘ</span>
                </label>
                <input type='text' id='api-key' name='api-key' required={true}/>
                <p id='api-key-error' className='hidden absolute bg-(--red) text-white px-2 py-[0.25rem] rounded-lg top-[5.5rem]'>
                  {apiKeyErrorText}
                </p>
              </div>
            </div>
            <div className='justify-self-end h-[60px] basis-full text-right'>
              <button type='submit' className='btn continue-btn place-self-end'>Continue</button>
            </div>
          </form>
      }
    </div>
  )
}