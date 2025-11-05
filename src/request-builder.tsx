import { CustomAppContext } from '@kontent-ai/custom-app-sdk';
import { createRef, FormEvent, useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import fetchItems from './utils/fetch-items';
import fetchTypes from './utils/fetch-types';
import { IContentType, ILanguage } from '@kontent-ai/delivery-sdk';
import fetchLanguages from './utils/fetch-languages';
import secureAccessTest from './utils/secure-access-test';
import previewTest from './utils/preview-test';
import { filteringOperators } from './utils/filtering-operators';

interface RequestBuilderProps {
  contextResponse?: CustomAppContext,
  workbook: XLSX.WorkBook
}

type Config = {
  deliveryKey?: string;
}

type SystemObj = {
  codename: string,
  collection: string,
  id: string,
  language: string,
  lastModified: string,
  name: string,
  type: string,
  workflow: string,
  workflowStep: string
}

export default function RequestBuilder({ contextResponse, workbook }: RequestBuilderProps) {
  interface ObjectWithArrays {
    [key: string]: any;
  }

  interface OneContentTypeSelectedInfo {
    boolean: boolean,
    initialLoad: boolean
  }

  const [insideKontentAi, setInsideKontentAi] = useState<boolean>(false);
  const [environmentId, setEnvironmentId] = useState<string>('');
  const [apiKey, setAPIKey] = useState<string>('');
  const [apiKeyErrorText, setAPIKeyErrorText] = useState<string>('');
  const [environmentIdErrorText, setEnvironmentIdErrorText] = useState<string>('');
  const [contentTypes, setContentTypes] = useState<Array<IContentType>>();
  const [languages, setLanguages] = useState<Array<ILanguage>>();
  const [loadingText, setLoadingText] = useState<string>('Checking custom app configuration...');
  const [exportBtnText, setExportBtnText] = useState<string>('Export content');
  const [backBtnText, setBackBtnText] = useState<string>('Change API key');
  const [validAPIKey, setValidAPIKey] = useState<boolean>(false);
  const [validConfigAPIKey, setValidConfigAPIKey] = useState<boolean>(false);
  const [elementFilterInputValues, setElementFilterInputValues] = useState<ObjectWithArrays>({});
  const [oneContentTypeSelected, setOneContentTypeSelected] = useState<OneContentTypeSelectedInfo>({ boolean: false, initialLoad: true });
  const [multipleLanguagesSelected, setMultipleLanguagesSelected] = useState<boolean>(false);
  const [showMultiLangAnnouncement, setShowMultiLangAnnouncement] = useState<boolean>(() => {
    // Check localStorage to see if user has dismissed the announcement
    // For testing: set to true to always show the announcement
    const FORCE_SHOW = false; // Set to true for testing
    if (FORCE_SHOW) return true;
    
    const dismissed = localStorage.getItem('multi-lang-announcement-dismissed');
    return dismissed !== 'true';
  });

  async function handleSubmit(event: FormEvent, type: string) {
    event.preventDefault();

    const apiKeyError = document.getElementById('api-key-error') as HTMLElement;
    const environmentIdError = document.getElementById('environment-id-error') as HTMLElement;
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

      if (environmentIdInput && keyInput) {
        if (environmentIdInput.value !== '' && keyInput.value !== '') {
          if (apiKeyError) apiKeyError.style.display = 'none';
          if (environmentIdError) environmentIdError.style.display = 'none';

          setAPIKey(keyInput.value.trim());
          setLoadingText('Validating your API key...');
          setEnvironmentId(environmentIdInput.value);
        }
        else {
          if (environmentIdInput.value === '') {
            if (environmentIdError) environmentIdError.style.display = 'inline-flex';
            setEnvironmentIdErrorText('Please provide an environment ID.');
          }
          else {
            if (environmentIdError) environmentIdError.style.display = 'none';
          } 
          
          if (keyInput.value === '') {
            if (apiKeyError) apiKeyError.style.display = 'inline-flex';
            setAPIKeyErrorText('Please provide an API key.');
          }
          else {
            if (apiKeyError) apiKeyError.style.display = 'none';
          }
        }
      }
      else if (environmentId) {
        if (keyInput.value !== '') {
          if (apiKeyError) apiKeyError.style.display = 'none';

          setAPIKey(keyInput.value.trim());
          setLoadingText('Validating your API key...');
        }
        else {
          if (keyInput.value === '') {
            if (apiKeyError) apiKeyError.style.display = 'inline-flex';
            setAPIKeyErrorText('Please provide an API key.');
          }
          else {
            if (apiKeyError) apiKeyError.style.display = 'none';
          }
        }
      }
    }
    else {
      const selectedTypes = document.querySelectorAll('input[type="checkbox"].content-type:checked');
      const selectedLanguages = document.querySelectorAll('input[type="checkbox"].language-option:checked') as NodeListOf<HTMLInputElement>;
      const selectedWorkflowStep = document.querySelector('input[name="content-workflow-step"]:checked') as HTMLInputElement;
      const selectedFileTypeInput = document.querySelector('input[name="file-type"]:checked') as HTMLInputElement;
      
      const itemName = (document.getElementById('filter-item-name') as HTMLInputElement).value.trim();
      const collection = (document.getElementById('collection-filter') as HTMLInputElement).value.trim();

      let elementsToFilter: (string | string[])[][] | undefined = [];

      const elementsToFilterInputs = document.querySelectorAll('div[style*="display: flex"] > .type-filters-container > input, div[style*="display: flex"] > .type-filters-container > div.num-filter-container > input') as NodeListOf<HTMLInputElement>;
      const elementsToFilterLabels = document.querySelectorAll('div[style*="display: flex"] > .type-filters-container > label') as NodeListOf<HTMLInputElement>;
      const elementFilteringOperators = document.querySelectorAll('div[style*="display: flex"] > .type-filters-container > select') as NodeListOf<HTMLSelectElement>;

      elementsToFilterInputs.forEach((elementInput, index) => {
        let filteringOperatorKeys, elementType;

        if (elementsToFilterLabels.length > 0) {
          let elementsToFilterLabelText = elementsToFilterLabels[index].textContent;

          if (elementsToFilterLabelText) {
            if (elementsToFilterLabelText[elementsToFilterLabelText.length - 1] === 'ⓘ') elementsToFilterLabelText = elementsToFilterLabelText.slice(0, elementsToFilterLabelText.length - 1);
          
            elementType = elementsToFilterLabelText.match(/\(([A-Za-z\s*A-Za-z^)]+)\)$/);
          }

          if (elementType) {
            if (elementType[1] === 'linked items') elementType[1] = 'modular_content';
            else elementType[1] = elementType[1].replace(' ', '_');
          }

          filteringOperatorKeys = Object.keys(filteringOperators[elementType![1] as keyof typeof filteringOperators]);
        }

        // Single value inputs, as well the number/date time inputs
        if (elementInput.value !== '') {
          if (elementInput.labels) {
            let value;

            if (filteringOperatorKeys!.filter(key => key.match(/^contains+/)).length > 0) {
              value = [elementInput.value];
            }
            else if (elementFilteringOperators[index].value === 'is in the range of') {
              const rangeInputContainer = elementInput.nextElementSibling;

              if (rangeInputContainer) {
                const rangeInput = rangeInputContainer.lastElementChild as HTMLInputElement;

                if (rangeInput) value = [elementInput.value, rangeInput.value];
              }
            }
            else value = elementInput.value;

            // Element type, filtering operator, element's codename, value to filter the element by
            if (elementType && value) elementsToFilter.push([elementType[1], elementFilteringOperators[index].value, elementsToFilterLabels[index].id, value]);
          }
        }
        // Multiple value inputs
        else if (filteringOperatorKeys!.filter(key => key.match(/^contains+/)).length > 0) {
          if (elementInput.labels) {
              let value;

              if (filteringOperatorKeys!.includes(elementFilteringOperators[index].value) && filteringOperatorKeys![0] !== elementFilteringOperators[index].value) {
                const elementCodename = elementInput.id.match(/-([a-zA-Z_]+)-/);

                let possibleValues: string | any[] = [];

                if (elementCodename && elementFilterInputValues[selectedTypes[0].id][elementCodename[1]]) possibleValues = Object.values(elementFilterInputValues[selectedTypes[0].id][elementCodename[1]]) as Array<string>;
                if (possibleValues.length > 0) value = [...possibleValues];
              }
              else value = elementInput.value;

              // Element type, filtering operator, element's codename, value to filter the element by
              if (elementType && value) elementsToFilter.push([elementType[1], elementFilteringOperators[index].value, elementsToFilterLabels[index].id, value]);
          }
        }
      })

      const selectedLastModifiedOperator = document.getElementById('last-modified-filtering-operator') as HTMLSelectElement;
      let lastModified = [];

      // Setting lastModified value
      if (selectedLastModifiedOperator) {
        if (selectedLastModifiedOperator.value !== Object.entries(filteringOperators.date_time)[Object.entries(filteringOperators.date_time).length - 1][0]) {
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
      if (selectedTypes.length === 0 || selectedLanguages.length === 0 || !selectedWorkflowStep || !selectedFileTypeInput) {
        const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

        if (!selectedFileTypeInput) {
          if (fileTypeError) fileTypeError.style.display = 'inline-flex';
          fileTypeError.scrollIntoView({ behavior: prefersReducedMotion.matches ? 'instant' : 'smooth', block: 'start', inline: 'start' });
        }
        else {
          if (fileTypeError) fileTypeError.style.display = 'none';
        }

        if (!selectedWorkflowStep) {
          if (workflowStepError) workflowStepError.style.display = 'inline-flex';
          workflowStepError.scrollIntoView({ behavior: prefersReducedMotion.matches ? 'instant' : 'smooth', block: 'start', inline: 'start' });
        }
        else {
          if (workflowStepError) workflowStepError.style.display = 'none';
        }

        if (selectedLanguages.length === 0) {
          if (languageError) languageError.style.display = 'inline-flex';
          languageError.scrollIntoView({ behavior: prefersReducedMotion.matches ? 'instant' : 'smooth', block: 'start', inline: 'start' });
        }
        else {
          if (languageError) languageError.style.display = 'none';
        }

        if (selectedTypes.length === 0) {
          if (contentTypeError) contentTypeError.style.display = 'inline-flex';
          contentTypeError.scrollIntoView({ behavior: prefersReducedMotion.matches ? 'instant' : 'smooth', block: 'start', inline: 'start' });
        }
        else {
          if (contentTypeError) contentTypeError.style.display = 'none';
        }
      }
      else {
        if (apiKeyError) apiKeyError.style.display = 'none';
        if (environmentIdError) environmentIdError.style.display = 'none';
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
          if ((checkbox as HTMLInputElement).value !== 'select-all-types') types.push((checkbox as HTMLInputElement).value);
        });
  
        let selectedFileType: string = '';
  
        if (selectedFileTypeInput) selectedFileType = selectedFileTypeInput.value;
  
        // Hide all per-language errors before running
        const allLanguageErrors = document.querySelectorAll('[id$="-lang-error"]') as NodeListOf<HTMLElement>;
        allLanguageErrors.forEach(el => { el.style.display = 'none'; });

        // Hide all per-language warnings before running
        const allLanguageWarnings = document.querySelectorAll('[id$="-no-content-all-skipped"], [id$="-some-no-content-skipped"]') as NodeListOf<HTMLElement>;
        allLanguageWarnings.forEach(el => { el.style.display = 'none'; });

        // ZIP container (CSV always uses ZIP; Excel will be decided after processing)
        const isCSV = selectedFileTypeInput && selectedFileTypeInput.value === 'csv';
        const zip = isCSV ? new JSZip() : null;

        // Generate timestamp for file names (format: YYYY-MM-DD)
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const timestamp = `${year}-${month}-${day}`;

        // Track skipped items (no content) across all languages
        let totalFoundAcrossLangs = 0;
        let totalExportedAcrossLangs = 0;
        
        // Track which languages had items successfully exported
        const languagesWithItems = new Set<string>();
        // Track which languages had items found (even if not exported)
        const languagesWithItemsFound = new Set<string>();
        // Track per-language counts for warnings
        const languageStats = new Map<string, { found: number; exported: number }>();
        // Collect Excel workbooks per language to decide later whether to zip or download directly
        const excelLangWorkbooks: Array<{ langNameForFile: string; workbook: XLSX.WorkBook }> = [];

        for (const langInput of Array.from(selectedLanguages)) {
          const langCode = langInput.value;
          
          // Find the language object to get the name for filesystem-friendly naming
          const langObj = languages?.find(lang => lang.system.codename === langCode);
          // Sanitize language name for filesystem: replace spaces/special chars with hyphens, remove leading/trailing hyphens
          const langNameForFile = langObj?.system.name
            .replace(/[^\w\s-]/g, '') // Remove special characters except hyphens and underscores
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .replace(/--+/g, '-') // Replace multiple hyphens with single hyphen
            .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
            || langCode; // Fallback to codename if name not found

          const data = await fetchItems(environmentId, apiKey, types, langCode, selectedWorkflowStep.value, { value: lastModified, filter: selectedLastModifiedOperator.value }, itemName, collection, elementsToFilter);

          if (data.items.length > 0) {
            // Track items found and exported for this specific language
            const langItemsFound = data.items.length;
            let langItemsExported = 0;

            const selectedAdditionalDataInputs = document.querySelectorAll('.additional-data-options:checked');
            let selectedAdditionalData: Array<string> = [];

            if (selectedAdditionalDataInputs) {
              for (const node of selectedAdditionalDataInputs.values()) {
                selectedAdditionalData.push(node.id.split('-')[1]);
              }
            }

            const itemsValues = data.items.map((item) => Object.entries(item.elements).map(obj => (obj[1].type !== 'modular_content' && obj[1].type !== 'asset' && obj[1].type !== 'taxonomy' && obj[1].type !== 'multiple_choice' ? obj[1].value : (obj[1].type === 'modular_content' ? obj[1].value.join(',') : (obj[1].type === 'asset' ? obj[1].value.map((asset: { url: string; }) => asset.url).join(',') : obj[1].value.map((val: { name: string; }) => val.name).join(','))))));

            const itemsSystemData: Array<SystemObj> = data.items.map((item) => item.system) as Array<SystemObj>;
            const items = data.items.map((item) => Object.entries(item.elements).map(obj => ({ [obj[1].name]: obj[1].value })));
    
            let currentType = data.items[0].system.type;
            // New workbook per language
            const langWorkbook = XLSX.utils.book_new();
            let currentWorksheet;
            let currentItems = [];
            totalFoundAcrossLangs += data.items.length;
    
            for (let i = 0; i < data.items.length; i++) {
              // Determine if item has any content in elements
              const hasContent = Object.values(data.items[i].elements).some((el: any) => {
                if (Array.isArray(el.value)) return el.value.length > 0;
                return (el.value ?? '') !== '';
              });
              
              // Standard item processing
              if (data.items[i].system.type === currentType && i !== data.items.length - 1) {
                if (selectedAdditionalData.length > 0 || hasContent) {
                  if (selectedAdditionalData.length > 0) {
                    const currentItemSystemData = selectedAdditionalData.map((systemKey) => itemsSystemData[i][systemKey as keyof SystemObj]);
                    currentItems.push(currentItemSystemData.concat(itemsValues[i]));
                  } 
                  else currentItems.push(itemsValues[i]);
                  totalExportedAcrossLangs += 1;
                  langItemsExported += 1;
                }
              }
              // The final item is not the only of its type
              else if (data.items[i].system.type === currentType && i === data.items.length - 1) {
                if (selectedAdditionalData.length > 0 || hasContent) {
                  if (selectedAdditionalData.length > 0) {
                    const currentItemSystemData = selectedAdditionalData.map((systemKey) => itemsSystemData[i][systemKey as keyof SystemObj]);
                    currentItems.push(currentItemSystemData.concat(itemsValues[i]));
                  }
                  else currentItems.push(itemsValues[i]);
                  totalExportedAcrossLangs += 1;
                  langItemsExported += 1;
                }

                // Only create worksheet if there are items to export
                if (currentItems.length > 0) {
                  let currentKeys;

                  if (selectedAdditionalData) currentKeys = [...selectedAdditionalData];
      
                  // Some of the below logic comes from: https://stackoverflow.com/a/64213063
                  if (items.length > 1 && selectedAdditionalData) currentKeys = [selectedAdditionalData.concat(items[i - 1].map(obj => Object.entries(obj)[0][0]))];
                  else if (items.length > 1) currentKeys = [items[i - 1].map(obj => Object.entries(obj)[0][0])];
                  else currentKeys = [items[i].map(obj => Object.entries(obj)[0][0])];

                  currentWorksheet = XLSX.utils.book_new();

                  XLSX.utils.sheet_add_aoa(currentWorksheet, currentKeys);
                  XLSX.utils.sheet_add_json(currentWorksheet, currentItems, { origin: 'A2', skipHeader: true });
      
                  if (currentWorksheet) XLSX.utils.book_append_sheet(langWorkbook, currentWorksheet, currentType);
                }
              }
              // The final item is the only of its type
              else if (data.items[i].system.type !== currentType && i === data.items.length - 1) {
                // Only create worksheet for previous type if there are items to export
                if (currentItems.length > 0) {
                  let currentKeys;

                  if (selectedAdditionalData) currentKeys = [selectedAdditionalData.concat(items[i - 1].map(obj => Object.entries(obj)[0][0]))];
                  else currentKeys = [items[i - 1].map(obj => Object.entries(obj)[0][0])];

                  currentWorksheet = XLSX.utils.book_new();
      
                  XLSX.utils.sheet_add_aoa(currentWorksheet, currentKeys);
                  XLSX.utils.sheet_add_json(currentWorksheet, currentItems, { origin: 'A2', skipHeader: true });
      
                  if (currentWorksheet) XLSX.utils.book_append_sheet(langWorkbook, currentWorksheet, currentType);
                }

                // Now handling the final item/type
                currentItems = [];

                if (selectedAdditionalData.length > 0 || hasContent) {
                  if (selectedAdditionalData.length > 0) {
                    const currentItemSystemData = selectedAdditionalData.map((systemKey) => itemsSystemData[i][systemKey as keyof SystemObj]);
                    currentItems.push(currentItemSystemData.concat(itemsValues[i]));
                  } 
                  else currentItems.push(itemsValues[i]);
                  totalExportedAcrossLangs += 1;
                  langItemsExported += 1;
                }
    
                // Only create worksheet if there are items to export
                if (currentItems.length > 0) {
                  let currentKeys;
                  if (selectedAdditionalData.length > 0) currentKeys = [selectedAdditionalData.concat(items[i].map(obj => Object.entries(obj)[0][0]))];
                  else currentKeys = [items[i].map(obj => Object.entries(obj)[0][0])];

                  currentWorksheet = XLSX.utils.book_new();
      
                  XLSX.utils.sheet_add_aoa(currentWorksheet, currentKeys);
                  XLSX.utils.sheet_add_json(currentWorksheet, currentItems, { origin: 'A2', skipHeader: true });
      
                  if (currentWorksheet) XLSX.utils.book_append_sheet(langWorkbook, currentWorksheet, data.items[i].system.type);
                }
              }
              // The item is the last of its type, but isn't the only one, and isn't the final item
              else {
                // Only create worksheet if there are items to export
                if (currentItems.length > 0) {
                  let currentKeys = [];

                  if (selectedAdditionalData) currentKeys = [selectedAdditionalData.concat(items[i - 1].map(obj => Object.entries(obj)[0][0]))];
                  else currentKeys = [items[i - 1].map(obj => Object.entries(obj)[0][0])];

                  currentWorksheet = XLSX.utils.book_new();
      
                  XLSX.utils.sheet_add_aoa(currentWorksheet, currentKeys);
                  XLSX.utils.sheet_add_json(currentWorksheet, currentItems, { origin: 'A2', skipHeader: true });
      
                  if (currentWorksheet) XLSX.utils.book_append_sheet(langWorkbook, currentWorksheet, currentType);
                }
    
                currentItems = [];
                currentType = data.items[i].system.type;

                if (selectedAdditionalData.length > 0 || hasContent) {
                  if (selectedAdditionalData.length > 0) {
                    const currentItemSystemData = selectedAdditionalData.map((systemKey) => itemsSystemData[i][systemKey as keyof SystemObj]);
                    currentItems.push(currentItemSystemData.concat(itemsValues[i]));
                  } 
                  else currentItems.push(itemsValues[i]);
                  totalExportedAcrossLangs += 1;
                  langItemsExported += 1;
                }
              }
            }

            // Only export workbook if it has sheets (items were actually exported)
            if (langWorkbook.SheetNames.length > 0) {
              if (selectedFileType === 'excel') {
                // Defer Excel export decision until after all languages are processed
                excelLangWorkbooks.push({ langNameForFile, workbook: langWorkbook });
              }
              else if (zip) {
                // CSV handling - add sheets to ZIP
                for (const sheetName of langWorkbook.SheetNames) {
                  const worksheet = langWorkbook.Sheets[sheetName];
                  const csv = XLSX.utils.sheet_to_csv(worksheet);
                  zip.file(`${environmentId}-export-${timestamp}/${langNameForFile}/${sheetName}.csv`, csv);
                }
              }
            }
            
            // Mark this language as having items found
            languagesWithItemsFound.add(langCode);
            
            // Mark this language as having exported items if any were exported
            if (langItemsExported > 0) {
              languagesWithItems.add(langCode);
            }
            // Store language stats for warning display
            languageStats.set(langCode, { found: langItemsFound, exported: langItemsExported });
          }
          // If no items found for this language, we defer error display until after all languages are processed
          // (see error handling logic below after the loop completes)
        }

        // Determine which error message(s) to show based on final export count
        const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
        let firstErrorElement: HTMLElement | null = null;
        
        if (totalExportedAcrossLangs === 0) {
          // No items exported at all - show general error, hide all per-language errors
          const noItemsError = document.getElementById('no-items-error') as HTMLElement;
          if (noItemsError) {
            noItemsError.style.display = 'inline-flex';
            (noItemsError as HTMLElement).style.alignItems = 'stretch';
            noItemsError.scrollIntoView({ behavior: prefersReducedMotion.matches ? 'instant' : 'smooth', block: 'start', inline: 'start' });
          }
          
          // Hide all per-language errors since we're showing the general one
          const allLanguageErrors = document.querySelectorAll('[id$="-lang-error"]') as NodeListOf<HTMLElement>;
          allLanguageErrors.forEach(el => { el.style.display = 'none'; });
        }
        else {
          // Some items were exported - show per-language errors for languages that had no items
          // Hide the general error since we have specific language errors
          const noItemsError = document.getElementById('no-items-error') as HTMLElement;
          if (noItemsError) noItemsError.style.display = 'none';
          
          // Show per-language errors for languages that had no items found at all
          for (const langInput of Array.from(selectedLanguages)) {
            const langCode = langInput.value;
            // Only show "No items found" if items were never found (not just if none were exported)
            if (!languagesWithItemsFound.has(langCode)) {
              const perLangError = document.getElementById(`${langCode}-lang-error`) as HTMLElement;
              if (perLangError) {
                perLangError.style.display = 'inline-flex';
                perLangError.style.alignItems = 'stretch';
                if (!firstErrorElement) firstErrorElement = perLangError;
              }
            }
          }
          
          // Scroll to first error if found
          if (firstErrorElement) {
            firstErrorElement.scrollIntoView({ behavior: prefersReducedMotion.matches ? 'instant' : 'smooth', block: 'start', inline: 'start' });
          }
        }
        
        // Show per-language no-content warnings
        let firstWarningElement: HTMLElement | null = null;
        for (const langInput of Array.from(selectedLanguages)) {
          const langCode = langInput.value;
          const stats = languageStats.get(langCode);
          
          if (stats) {
            if (stats.found > 0 && stats.exported === 0) {
              // All items found but none exported (all had no content)
              const allSkippedWarning = document.getElementById(`${langCode}-no-content-all-skipped`) as HTMLElement;
              if (allSkippedWarning) {
                allSkippedWarning.style.display = 'inline-flex';
                allSkippedWarning.style.alignItems = 'stretch';
                if (!firstWarningElement) firstWarningElement = allSkippedWarning;
              }
            }
            else if (stats.found > stats.exported) {
              // Some items exported but some were skipped (had no content)
              const someSkippedWarning = document.getElementById(`${langCode}-some-no-content-skipped`) as HTMLElement;
              if (someSkippedWarning) {
                someSkippedWarning.style.display = 'inline-flex';
                someSkippedWarning.style.alignItems = 'stretch';
                if (!firstWarningElement) firstWarningElement = someSkippedWarning;
              }
            }
          }
        }
        
        // Scroll to first warning if found and no error was scrolled to
        if (firstWarningElement && totalExportedAcrossLangs > 0 && !firstErrorElement) {
          firstWarningElement.scrollIntoView({ behavior: prefersReducedMotion.matches ? 'instant' : 'smooth', block: 'start', inline: 'start' });
        }

        // Finalize downloads
        if (selectedFileType === 'excel') {
          if (excelLangWorkbooks.length === 1) {
            // Direct download for a single language with data
            const only = excelLangWorkbooks[0];
            XLSX.writeFile(only.workbook, `${environmentId}-${only.langNameForFile}-export-${timestamp}.xlsx`);
          }
          else if (excelLangWorkbooks.length > 1) {
            // Multiple languages with data: zip the Excel files together
            const excelZip = new JSZip();
            for (const entry of excelLangWorkbooks) {
              const buffer = XLSX.write(entry.workbook, { bookType: 'xlsx', type: 'array' });
              excelZip.file(`${environmentId}-export-${timestamp}/${entry.langNameForFile}/${environmentId}-${entry.langNameForFile}-export-${timestamp}.xlsx`, buffer);
            }
            const zipBlob = await excelZip.generateAsync({ type: 'blob' });
            const downloadLink = document.createElement('a');
            downloadLink.href = URL.createObjectURL(zipBlob);
            downloadLink.download = `${environmentId}-export-${timestamp}.zip`;
            downloadLink.click();
          }
        } else if (zip) {
          // CSV case
          const zipBlob = await zip.generateAsync({ type: 'blob' });
          const downloadLink = document.createElement('a');
          downloadLink.href = URL.createObjectURL(zipBlob);
          downloadLink.download = `${environmentId}-export-${timestamp}.zip`;
          downloadLink.click();
        }

        setExportBtnText('Export content')
        if (exportBtn) exportBtn.removeAttribute('disabled');
        if (loadingExportSpinner) loadingExportSpinner.style.display = 'none';
      }
    }
  }

  function handleBackBtn() {
    setValidAPIKey(false);
    setEnvironmentId('');
    setAPIKey('');
    setContentTypes([]);
    setLanguages([]);
    setElementFilterInputValues({});
    setOneContentTypeSelected({boolean: false, initialLoad: true});
    setMultipleLanguagesSelected(false);
  }

  function handleCloseMultiLangAnnouncement() {
    setShowMultiLangAnnouncement(false);
    localStorage.setItem('multi-lang-announcement-dismissed', 'true');
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

  function handleTypeFilterSelection() {
    const selectedCheckboxes = document.querySelectorAll('input[type="checkbox"].content-type:checked') as NodeListOf<HTMLInputElement>;
    const filterElementsContainer = document.getElementById('type-to-filter-container');

    if (selectedCheckboxes.length === 1) {
      const value = selectedCheckboxes[0].value;
      const elementsContainer = document.getElementById(`${value}-filters-container`);

      if (elementsContainer && filterElementsContainer) {
        filterElementsContainer.style.display = 'flex';
        elementsContainer.style.display = 'flex';
      }
  
      const allTypeFiltersContainers = document.querySelectorAll('.type-filters-container');
  
      if (allTypeFiltersContainers) {
        allTypeFiltersContainers.forEach((filterContainer) => {
          if (filterContainer.parentElement) {
            if (filterContainer.parentElement.id !== `${value}-filters-container`) {
              filterContainer.parentElement.style.display = 'none';
            }
          }
        })
      }
      setOneContentTypeSelected({boolean: true, initialLoad: false});
    }
    else {
      if (filterElementsContainer) filterElementsContainer.style.display = 'none';

      const allTypeFiltersContainers = document.querySelectorAll('.type-filters-container');
  
      if (allTypeFiltersContainers) {
        allTypeFiltersContainers.forEach((filterContainer) => {
          if (filterContainer.parentElement) {
            filterContainer.parentElement.style.display = 'none';
          }
        })
      }
      setOneContentTypeSelected({boolean: false, initialLoad: false});
    }
  }

  function handleSelectAllLanguages(target: HTMLInputElement) {
    const languageCheckboxes = document.querySelectorAll('input[type="checkbox"].language-option');
    for (let i = 0; i < languageCheckboxes.length; i++) {
      (languageCheckboxes[i] as HTMLInputElement).checked = target.checked;
    }
    const count = document.querySelectorAll('input[type="checkbox"].language-option:checked').length;
    setMultipleLanguagesSelected(count > 1);
  }

  function handleLanguageCheckboxChange() {
    const count = document.querySelectorAll('input[type="checkbox"].language-option:checked').length;
    setMultipleLanguagesSelected(count > 1);
  }

  function handleAddValues(addButton: HTMLButtonElement) {
    if (addButton) {
      const valueInput = addButton.parentElement?.querySelector('input');
      const selectedTypes = document.querySelectorAll('input[type="checkbox"].content-type:checked');

      if (valueInput && selectedTypes.length === 1) {
        const elementCodename = valueInput.id.match(/-([a-zA-Z_]+)-/);

        if (elementCodename && valueInput.value !== '') {
          const elementValuesContainer = document.getElementById(`${selectedTypes[0].id}-${elementCodename[1]}-values-container`);

          if (elementValuesContainer) {
            // If any values have already been added to elementFilterInputValues
            if (elementValuesContainer.children.length > 0) {
              const numRegex = /-(\d+)$/;
              const lastChild = elementValuesContainer.lastElementChild;
              let lastChildId;
              let lastChildNum = 0;

              if (lastChild) {
                lastChildId = lastChild.id;
                if (lastChildId) {
                  const numMatches = lastChildId.match(numRegex);
                  if (numMatches) lastChildNum = Number(numMatches[1]);
                } 
              }

              if (elementFilterInputValues) {
                if (elementFilterInputValues[selectedTypes[0].id]) {
                  if (elementFilterInputValues[selectedTypes[0].id][elementCodename[1]]) {
                    setElementFilterInputValues({
                      ...elementFilterInputValues,
                      [selectedTypes[0].id]: {
                        ...elementFilterInputValues[selectedTypes[0].id],
                        [elementCodename[1]]: {
                          ...elementFilterInputValues[selectedTypes[0].id][elementCodename[1]],
                          [`${selectedTypes[0].id}-${elementCodename[1]}-value-${lastChildNum + 1}`]: valueInput.value.trim()
                        }
                      }
                    });
                  }
                  // If the type's element wasn't added yet
                  else {
                    setElementFilterInputValues({
                      ...elementFilterInputValues,
                      [selectedTypes[0].id]: {
                        ...elementFilterInputValues[selectedTypes[0].id],
                        [elementCodename[1]]: {
                          [`${selectedTypes[0].id}-${elementCodename[1]}-value-${lastChildNum + 1}`]: valueInput.value.trim()
                        }
                      }
                    });
                  } 
                }
                // If the type wasn't already added to elementFilterInputValues
                else {
                  setElementFilterInputValues({
                    ...elementFilterInputValues,
                    [selectedTypes[0].id]: {
                      [elementCodename[1]]: {
                        [`${selectedTypes[0].id}-${elementCodename[1]}-value-${lastChildNum + 1}`]: valueInput.value.trim()
                      }
                    }
                  });
                }
              }
              // If elementFilterInputValues is empty
              else {
                setElementFilterInputValues({
                  [selectedTypes[0].id]: {
                    [elementCodename[1]]: {
                      [`${selectedTypes[0].id}-${elementCodename[1]}-value-${lastChildNum + 1}`]: valueInput.value.trim()
                    }
                  }
                });
              }
            }
            // If no values have been added yet to elementFilterInputValues
            else {
              if (elementFilterInputValues) {
                  setElementFilterInputValues({
                    ...elementFilterInputValues,
                    [selectedTypes[0].id]: {
                      ...elementFilterInputValues[selectedTypes[0].id],
                      [elementCodename[1]]: {
                        [`${selectedTypes[0].id}-${elementCodename[1]}-value-1`]: valueInput.value.trim()
                      }
                    }
                  });
              }
            }
          }
        }
        valueInput.value = '';
      }
    }
  }

  function handleDeleteValues(deleteButton: HTMLButtonElement) {
    if (deleteButton) {
      const valueSpan = deleteButton.parentElement as HTMLSpanElement;
      const selectedTypes = document.querySelectorAll('input[type="checkbox"]:checked');

      if (valueSpan) {
        const elementCodename = valueSpan.id.match(/-([a-zA-Z_]+)-/);

        if (elementCodename) {
          let currentValues = {...elementFilterInputValues[selectedTypes[0].id][elementCodename[1]]};
          delete currentValues[valueSpan.id];

          setElementFilterInputValues({
            ...elementFilterInputValues,
            [selectedTypes[0].id]: {
              ...elementFilterInputValues[selectedTypes[0].id],
              [elementCodename[1]]: {
                ...currentValues
              }
            }
          });
        }
      }
    }
  }

  function handleAddBtnDisplay(target: EventTarget & HTMLSelectElement, elementType: string, idPrefix: string) {
    const filterValue = target.value;
    let valuesContainerId, valuesContainer;

    if (idPrefix) valuesContainerId = `${idPrefix}-values-container`;
    if (valuesContainerId) valuesContainer = document.getElementById(valuesContainerId);

    const filteringOperatorKeys = Object.keys(filteringOperators[elementType as keyof typeof filteringOperators]);
    filteringOperatorKeys.shift();

    if (filteringOperatorKeys.includes(filterValue)) {
      if (idPrefix) {
        const addBtnId = `${idPrefix}-add-btn`;
        const addBtn = document.getElementById(addBtnId);

        if (valuesContainer) valuesContainer.style.display = 'flex';
        if (addBtn) addBtn.style.display = 'block';
      }
    }
    else {
      if (idPrefix) {
        const addBtnId = `${idPrefix}-add-btn`;
        const addBtn = document.getElementById(addBtnId);
        
        if (valuesContainer) valuesContainer.style.display = 'none';
        if (addBtn) addBtn.style.display = 'none';
      }
    }

    const rangeContainer = document.getElementById(`${idPrefix}-range-container`);

    if (filterValue === 'is in the range of') {
      if (rangeContainer) rangeContainer.style.display = 'flex';
    }
    else {
      if (rangeContainer) rangeContainer.style.display = 'none';
    }
  }

  function handleEnterPress(e: React.KeyboardEvent<HTMLElement>) {
    e.preventDefault();
    console.log('enter pressed');
    const targetInput = e.currentTarget;

    if (targetInput) {
      const addBtn = targetInput.nextElementSibling;
      if (addBtn) handleAddValues(addBtn as HTMLButtonElement);
    }
  }

  useEffect(() => {
    if (Object.keys(elementFilterInputValues).length === 0 && oneContentTypeSelected.initialLoad === true) {
      const apiKeyError = document.getElementById('api-key-error') as HTMLElement;
      const environmentIdError = document.getElementById('environment-id-error') as HTMLElement;
      const noItemsError = document.getElementById('no-items-error') as HTMLElement;
      // const noContentAllSkipped = document.getElementById('no-content-all-skipped') as HTMLElement;
      // const someNoContentSkipped = document.getElementById('some-no-content-skipped') as HTMLElement;
      const contentTypeError = document.getElementById('content-type-error') as HTMLElement;
      const languageError = document.getElementById('language-error') as HTMLElement;
      const workflowStepError = document.getElementById('workflow-step-error') as HTMLElement;
      const fileTypeError = document.getElementById('file-type-error') as HTMLElement;
      const loadingContainer = document.getElementById('loading-container') as HTMLElement;
      const loadingExportSpinner = document.getElementById('loading-export') as HTMLElement;
      // const allLanguageErrors = document.querySelectorAll('[id$="-lang-error"]') as NodeListOf<HTMLElement>;
      // allLanguageErrors.forEach(el => { el.style.display = 'none'; });

      if (loadingExportSpinner) loadingExportSpinner.style.display = 'none';    
      if (loadingContainer) loadingContainer.style.display = 'flex';
      if (apiKeyError) apiKeyError.style.display = 'none';
      if (environmentIdError) environmentIdError.style.display = 'none';
      if (noItemsError) noItemsError.style.display = 'none';
      if (contentTypeError) contentTypeError.style.display = 'none';
      if (languageError) languageError.style.display = 'none';
      if (workflowStepError) workflowStepError.style.display = 'none';
      if (fileTypeError) fileTypeError.style.display = 'none';
      // Hide all per-language errors and warnings
      const allLanguageErrors = document.querySelectorAll('[id$="-lang-error"], [id$="-no-content-all-skipped"], [id$="-some-no-content-skipped"]') as NodeListOf<HTMLElement>;
      allLanguageErrors.forEach(el => { el.style.display = 'none'; });
      // Hide multi-language elements warning
      setMultipleLanguagesSelected(false);

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

                if (environmentIdError && response[0] === 'N') environmentIdError.style.display = 'inline-flex';
                else if (apiKeyError) apiKeyError.style.display = 'inline-flex';
                
                if (contextResponse.config) {
                  if ((contextResponse.config as Config).deliveryKey) {
                    setValidConfigAPIKey(false);
                    setAPIKeyErrorText("Missing or invalid key. Please adjust the custom app's configuration, or input a valid key above.");
                  }
                }
                else if (response[0] === 'N') setEnvironmentIdErrorText("Please make sure your environment ID is valid.");
                else setAPIKeyErrorText("Invalid key. Please make sure your key has 'Secure access' enabled.");
              }
              else {
                previewTest(environmentId, apiKey).then(async (response) => {
                  if (typeof response === 'string') {
                    if (loadingContainer) loadingContainer.style.display = 'none';
                    if (apiKeyError) apiKeyError.style.display = 'inline-flex';
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
                        if (apiKeyError) apiKeyError.style.display = 'inline-flex';
                      }
                      else if (response.items.length === 0) {
                        if (loadingContainer) loadingContainer.style.display = 'none';
                        if (apiKeyError) apiKeyError.style.display = 'inline-flex';
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
                            if (apiKeyError) apiKeyError.style.display = 'inline-flex';
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
                if (response[0] === 'N') setEnvironmentIdErrorText("Please make sure your environment ID is valid.");
                else setAPIKeyErrorText("Invalid key. Please make sure your key has 'Secure access' enabled.");

                if (loadingContainer) loadingContainer.style.display = 'none';

                if (environmentIdError && response[0] === 'N') environmentIdError.style.display = 'inline-flex';
                else if (apiKeyError) apiKeyError.style.display = 'inline-flex';
              }
              else {
                previewTest(environmentId, apiKey).then(async (response) => {
                  if (typeof response === 'string') {
                    setAPIKeyErrorText("Invalid key. Please make sure your key has 'Content preview' enabled.");
                    if (loadingContainer) loadingContainer.style.display = 'none';
                    if (apiKeyError) apiKeyError.style.display = 'inline-flex';
                  }
                  else {
                    setLoadingText('Fetching content types...');

                    fetchTypes(environmentId, apiKey).then(async (response) => {
                      if (response === 'error') {
                        if (loadingContainer) loadingContainer.style.display = 'none';
                        if (apiKeyError) apiKeyError.style.display = 'inline-flex';
                      }
                      else if (response.items.length === 0) {
                        if (loadingContainer) loadingContainer.style.display = 'none';
                        if (apiKeyError) apiKeyError.style.display = 'inline-flex';
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
                            if (apiKeyError) apiKeyError.style.display = 'inline-flex';
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

      const typeCheckboxes = document.querySelectorAll('input[type="checkbox"].content-type');
      const selectAllTypeCheckboxes = document.getElementById('select-all-types');

      if (typeCheckboxes.length > 0 && selectAllTypeCheckboxes) {
        selectAllTypeCheckboxes.addEventListener('change', function() {
          for (let i = 0; i < typeCheckboxes.length; i++) {
            (typeCheckboxes[i] as HTMLInputElement).checked = (this as HTMLInputElement).checked;
          }
        });
      }

      const dataCheckboxes = document.querySelectorAll('input[type="checkbox"].additional-data-options');
      const selectAllDataCheckboxes = document.getElementById('select-all-data');

      if (dataCheckboxes.length > 0 && selectAllDataCheckboxes) {
        selectAllDataCheckboxes.addEventListener('change', function() {
          for (let i = 0; i < dataCheckboxes.length; i++) {
            (dataCheckboxes[i] as HTMLInputElement).checked = (this as HTMLInputElement).checked;
          }
        });
      }

      const languageCheckboxes = document.querySelectorAll('input[type="checkbox"].language-option');
      const selectAllLanguageCheckbox = document.getElementById('select-all-languages');

      if (languageCheckboxes.length > 0 && selectAllLanguageCheckbox) {
        selectAllLanguageCheckbox.addEventListener('change', function() {
          for (let i = 0; i < languageCheckboxes.length; i++) {
            (languageCheckboxes[i] as HTMLInputElement).checked = (this as HTMLInputElement).checked;
          }
          const count = document.querySelectorAll('input[type="checkbox"].language-option:checked').length;
          console.log('count 1', count);
          
          setMultipleLanguagesSelected(count > 1);
        });
      }

      // Track changes on individual language checkboxes to update the warning visibility
      if (languageCheckboxes.length > 0) {
        const updateLanguageSelectedCount = () => {
          const count = document.querySelectorAll('input[type="checkbox"].language-option:checked').length;
          console.log('count', count);
          setMultipleLanguagesSelected(count > 1);
        };

        languageCheckboxes.forEach(cb => {
          cb.addEventListener('change', updateLanguageSelectedCount);
        });

        // Initialize on mount
        updateLanguageSelectedCount();
      }
    }
  }, [contextResponse, apiKey, environmentId, validAPIKey, elementFilterInputValues, oneContentTypeSelected])

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
            <p id='no-items-error' className='hidden fixed top-[72px] left-1/2 -translate-x-1/2 z-20 rounded-lg overflow-hidden whitespace-nowrap border-0'>
              <span className='bg-(--red) text-white px-2 py-[0.25rem] inline-flex items-center flex-shrink-0 rounded-l-lg message-icon-section'>
                <span className='error-icon'>⚠</span>
              </span>
              <span className='bg-gray-100 text-black px-2 py-[0.25rem] inline-flex items-center rounded-r-lg'>
                No items were found with the selected filters.
              </span>
            </p>
            {/* Content types */}
            <fieldset className='basis-full flex flex-wrap'>
              <details className='basis-full flex flex-wrap' open>
                <summary className='basis-full'>
                  <div className='relative'>
                    <legend className='font-bold text-[16px] text-left section-heading'>
                      Content types
                      <span className='tooltip-icon' title='These are the content types of the items that will be exported.'>ⓘ</span>
                    </legend>
                    <p id='content-type-error' className='hidden absolute left-[165px] top-0 items-stretch rounded-lg overflow-hidden'>
                      <span className='bg-(--red) text-white px-2 py-[0.25rem] items-center flex-shrink-0 message-icon-section'>
                        <span className='error-icon'>⚠</span>
                      </span>
                      <span className='bg-gray-100 text-black px-2 py-[0.25rem] items-center'>
                        Please select at least one content type.
                      </span>
                    </p>
                  </div>
                </summary>
                <div className='basis-full flex mb-3 pl-10'>
                  <div className='basis-full relative'>
                    <label htmlFor='select-all-types' className='input-container relative flex items-center'>
                      <input type='checkbox' className='mr-[8px] accent-(--purple)' id='select-all-types' value='select-all-types'/>
                      Select all
                    </label>
                  </div>
                </div>
                <div className='pl-18 flex flex-wrap'>
                {
                  contentTypes !== null && contentTypes !== undefined ?
                      contentTypes.map((type, index) =>
                        <div className={`flex flex-wrap basis-full  ${index === contentTypes.length - 1 ? 'mb-6' : 'mb-3'}`} key={`${type.system.codename}-container`}>
                          <div className='basis-full relative'>
                            <label htmlFor={type.system.codename} className='input-container relative flex items-center mb-1.5'>
                              <input type='checkbox' className='mr-[8px] accent-(--purple) content-type' id={type.system.codename} value={type.system.codename} onChange={() => handleTypeFilterSelection()}/>
                              {type.system.name}
                            </label>
                          </div>
                        </div>
                      )
                  : <p>No content types found.</p>
                }
                </div>
              </details>
            </fieldset>
            {/* Language */}
            <fieldset className='basis-full flex flex-wrap'>
              <details className='basis-full flex flex-wrap' open>
                <summary className='basis-full'>
                  <div className='relative'>
                    <legend className='font-bold text-[16px] text-left section-heading'>
                      Languages
                      <span className='tooltip-icon' title='These are the languages your content items can be exported in.'>ⓘ</span>
                    </legend>
                    <p id='language-error' className='hidden absolute left-[165px] top-0 items-stretch rounded-lg overflow-hidden'>
                      <span className='bg-(--red) text-white px-2 py-[0.25rem] items-center flex-shrink-0 message-icon-section'>
                        <span className='error-icon'>⚠</span>
                      </span>
                      <span className='bg-gray-100 text-black px-2 py-[0.25rem] items-center'>
                        Please select a language.
                      </span>
                    </p>
                    {showMultiLangAnnouncement && (
                      <div className='absolute bottom-0 mt-2 left-[12rem] inline-flex items-stretch rounded-lg overflow-hidden z-10'>
                        <div className='bg-(--green) text-white px-2 py-[0.25rem] inline-flex items-center flex-shrink-0 message-icon-section'>
                          <span className='announcement-icon'>New!</span>
                        </div>
                        <div className='bg-gray-100 text-black px-2 py-[0.25rem] inline-flex items-center'>
                          <span className='text-[12px] mr-2'>You can now select and export multiple languages at once.</span>
                          <button
                            type='button'
                            className='delete-btn flex items-center justify-center bg-transparent border-none cursor-pointer p-0'
                            onClick={handleCloseMultiLangAnnouncement}
                            title='Close'
                            aria-label='Close announcement'
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="size-7">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </summary>
                <div className='basis-full flex mb-3 pl-10'>
                  <label htmlFor='select-all-languages' className='input-container flex place-items-center'>
                    <input type='checkbox' className='mr-[8px] accent-(--purple)' id='select-all-languages' value='select-all-languages' onChange={(e) => handleSelectAllLanguages(e.currentTarget)} />
                    Select all
                  </label>
                </div>
                <div className='pl-18 flex flex-wrap'>
                {
                  languages !== null && languages !== undefined  ?
                      languages.map((lang, index) =>
                        <div className={`flex flex-wrap basis-full  ${index === languages.length - 1 ? 'mb-6' : 'mb-3'}`} key={`${lang.system.codename}-container`}>
                          <div className='basis-full relative'>
                            <label htmlFor={lang.system.codename} className='input-container relative flex items-center mb-1.5'>
                              <input type='checkbox' className='mr-[8px] accent-(--purple) language-option' id={lang.system.codename} value={lang.system.codename} onChange={() => handleLanguageCheckboxChange()} />
                              {lang.system.name}
                              <p id={`${lang.system.codename}-lang-error`} className='hidden ml-4 text-[12px]'>
                                <span className='bg-(--red) text-white px-2 py-[0.25rem] inline-flex items-center flex-shrink-0 rounded-l-lg message-icon-section'>
                                  <span className='error-icon'>⚠</span>
                                </span>
                                <span className='bg-gray-100 text-black px-2 py-[0.25rem] inline-flex items-center rounded-r-lg'>
                                  No items were found.
                                </span>
                              </p>
                              <p id={`${lang.system.codename}-no-content-all-skipped`} className='hidden ml-4 text-[12px]'>
                                <span className='bg-(--warning-yellow) text-black px-2 py-[0.25rem] inline-flex items-center flex-shrink-0 rounded-l-lg message-icon-section'>
                                  <span className='warning-icon'>!</span>
                                </span>
                                <span className='bg-gray-100 text-black px-2 py-[0.25rem] inline-flex items-center rounded-r-lg'>
                                  All items found had no content. Select options from 'Item details' to export metadata-only rows.
                                </span>
                              </p>
                              <p id={`${lang.system.codename}-some-no-content-skipped`} className='hidden ml-4 text-[12px]'>
                                <span className='bg-(--warning-yellow) text-black px-2 py-[0.25rem] inline-flex items-center flex-shrink-0 rounded-l-lg message-icon-section'>
                                  <span className='warning-icon'>!</span>
                                </span>
                                <span className='bg-gray-100 text-black px-2 py-[0.25rem] inline-flex items-center rounded-r-lg'>
                                  Some items had no content and were skipped.
                                </span>
                              </p>
                            </label>
                          </div>
                        </div>
                      )
                  : <p>No languages found.</p>
                }
                </div>
              </details>
            </fieldset>
            {/* Workflow step */}
            <fieldset className='basis-full flex flex-wrap'>
              <details className='basis-full flex flex-wrap' open>
                <summary className='basis-full'>
                  <div className='relative'>
                    <legend className='font-bold text-[16px] text-left section-heading'>
                        Workflow step
                      <span className='tooltip-icon' title='Be sure to choose a workflow step that your selected content type(s) items are available in. If they are not available, they will not be exported.'>
                        ⓘ
                      </span>
                    </legend>
                    <p id='workflow-step-error' className='hidden absolute left-[165px] top-0 items-stretch rounded-lg overflow-hidden'>
                      <span className='bg-(--red) text-white px-2 py-[0.25rem] items-center flex-shrink-0 message-icon-section'>
                        <span className='error-icon'>⚠</span>
                      </span>
                      <span className='bg-gray-100 text-black px-2 py-[0.25rem] items-center'>
                        Please select a workflow step.
                      </span>
                    </p>
                  </div>
                </summary>
                <div className='basis-full flex mb-3 pl-10'>
                  <label htmlFor='latest-version-radio-btn' className='input-container flex place-items-center'>
                    <input type='radio' id='latest-version-radio-btn' className='mr-[8px] accent-(--purple)' name='content-workflow-step' value={'latest-version'} />
                    Any (latest version)
                  </label>
                </div>
                <div className='basis-full flex mb-3 pl-10'>
                  <label htmlFor='published-radio-btn' className='input-container flex place-items-center'>
                    <input type='radio' id='published-radio-btn' className='mr-[8px] accent-(--purple)' name='content-workflow-step' value={'published'} />
                    Published
                  </label>
                </div>
                <div className='basis-full flex mb-6 pl-10'>
                  <label htmlFor='draft-radio-btn' className='input-container flex place-items-center'>
                    <input type='radio' id='draft-radio-btn' className='mr-[8px] accent-(--purple)' name='content-workflow-step' value={'draft'} />
                    Draft
                  </label>
                </div>
              </details>
            </fieldset>
            {/* Optional filters */}
            <fieldset className='basis-full flex flex-wrap'>
              <details id='optional-filters-container' className='basis-full'>
                <summary>
                  <div className='relative basis-full'>
                    <legend className='font-bold text-[16px] text-left section-heading'>
                      Optional filters
                      <span className='tooltip-icon' title='These filters will apply to your entire search, regardless of content type.'>ⓘ</span>
                    </legend>
                  </div>
                </summary>
                <div id='filter-item-name-container' className='flex flex-wrap mb-6 pl-12.5'>
                  <label htmlFor='filter-item-name' className='basis-full flex place-items-center mb-1.5'>
                    <span className='font-semibold'>Item name</span>
                  </label>
                  <input id='filter-item-name' type='text' className='basis-full mb-1.5' />
                </div>
                <div id='collection-container' className='flex flex-wrap mb-6 pl-12.5'>
                  <label htmlFor='collection-filter' className='basis-full flex place-items-center mb-1.5'>
                    <span className='font-semibold'>Collection</span>
                    <span className='tooltip-icon-small' title="This requires the collection's codename. It can be found under 'Environment settings' -> 'Collections', and then by clicking on the {#} button from the right side of the collection's name.">ⓘ</span>
                  </label>
                  <input id='collection-filter' type='text' className='basis-full mb-1.5' placeholder="Collection codename" />
                </div>
                <div id='last-modified-container' className='flex flex-wrap mb-6 pl-12.5'>
                  <label htmlFor='last-modified' className='basis-full flex place-items-center mb-1.5'>
                    <span className='font-semibold'>Last modified date</span>
                  </label>
                  <select id='last-modified-filtering-operator' name='last-modified-filtering-operator' className='basis-full mb-3' onChange={(e) => e.target.value === Object.entries(filteringOperators.date_time)[Object.entries(filteringOperators.date_time).length - 1][0] ? handleRange('range') : handleRange('not range')}>
                    {
                      Object.entries(filteringOperators.date_time).map((operator) =>
                        operator[0] !== 'equals' && operator[0] !== 'does not equal' ?
                          <option value={operator[0]} key={`${operator[0]}-key`}>{operator[0]}</option>
                        : null
                      )
                    }
                  </select>
                  <input id='last-modified' type='date' className='basis-full mb-1.5' />
                  <div id='last-modified-range-container' className='basis-full hidden flex-wrap'>
                    <p className='basis-full text-left mb-1.5 py-[0.25rem] px-[0.5rem] text-[14px]'>and</p>
                    <input id='last-modified-range' type='date' className='basis-full mb-3' />
                  </div>
                </div>
                <div className='flex flex-wrap mb-6 pl-12.5'>
                  <fieldset className='basis-full flex flex-wrap place-items-center'>
                    <legend className='inline-block text-left text-[14px]'>
                      <span className='font-semibold'>Content type's elements</span>
                      { multipleLanguagesSelected && oneContentTypeSelected.boolean ? (
                        <span
                          className='ml-2 inline-flex align-middle items-stretch rounded-lg overflow-hidden text-[12px]'
                          title="Their values typically differ by language, so the exported content will likely only contain the language used for the filter's value. For example, if you have English and Spanish selected, and then filter by a text element with the value 'Hello', none of the Spanish variants will be exported because that element's value in the Spanish variants is 'Hola'."
                        >
                          <span className='bg-(--lighter-purple) text-black px-2 py-[0.25rem] inline-flex items-center flex-shrink-0 message-icon-section'>
                            <span className='tooltip-icon-tiny'>ⓘ</span>
                          </span>
                          <span className='bg-gray-100 text-black px-2 py-[0.25rem] inline-flex items-center'>
                            <span className='ml-1'>Text, rich text, and URL slug element filters aren't reliable with multiple languages selected.</span>
                          </span>
                        </span>
                      ) : null }
                    </legend>
                    {
                      oneContentTypeSelected.boolean === false ?
                        <aside className='text-[14px] mt-1.5 bg-gray-100 p-4 rounded-xl'>
                          <span className='italic'>Filtering by a content type's elements is only available when one content type is selected.</span>
                        </aside>
                      : null
                    }
                    <div id='type-to-filter-container' className='hidden flex-wrap'>
                    {/* Content type's elements */}
                    {
                      contentTypes !== null && contentTypes !== undefined ? 
                        contentTypes.map((type) =>
                          <div id={`${type.system.codename}-filters-container`} className='hidden basis-full flex-wrap mt-3' key={`${type.system.codename}-filters-container`}>
                            {
                              Object.values(type.elements).map((element, index, arr) =>
                                element.type !== 'custom' && element.type !== 'asset' ? 
                                  <div className={`basis-full relative flex flex-wrap pl-6 ${ index !== arr.length - 1 ? 'mb-5' : ''} type-filters-container`} key={`${element.codename}-container`}>
                                    <label id={element.codename} htmlFor={`${type.system.codename}-${element.codename}-input`} className='basis-full flex place-items-center mb-1.5'>
                                      {element.name} 
                                      <span className='ml-1.5 text-gray-600'>
                                        ({element.type !== 'modular_content' ? element.type.replace('_', ' ') : 'linked items'})
                                      </span>
                                      {
                                        element.type === 'modular_content' || element.type === 'multiple_choice' || element.type === 'subpages' || element.type === 'taxonomy'
                                        ?
                                          <span className='tooltip-icon' title="The value(s) must be the codenames of what you would like to filter by. You can find the codename for all entities by looking for the text 'Codename' or this symbol: {#}">ⓘ</span>
                                        : null
                                      }
                                    </label>
                                    <select id={`${type.system.codename}-${element.codename}-filter`} className='type-filter-operator' onChange={(e) => handleAddBtnDisplay(e.target, element.type, `${type.system.codename}-${element.codename}`)}>
                                      { Object.entries(filteringOperators[element.type as keyof typeof filteringOperators]).map((filter) =>
                                          <option value={filter[0]} key={filter[0]}>
                                            {filter[0]}
                                          </option>
                                        )
                                      }
                                    </select>
                                    <div id={`${type.system.codename}-${element.codename}-values-container`} className='hidden flex flex-wrap'>
                                    {
                                      Object.keys(elementFilterInputValues).length > 0 && Object.keys(elementFilterInputValues).includes(type.system.codename) ?
                                        Object.keys(elementFilterInputValues[type.system.codename]).includes(element.codename!) ? 
                                          Object.entries(elementFilterInputValues[type.system.codename][element.codename as keyof typeof elementFilterInputValues]).map((obj) =>
                                            <span id={obj[0]} className='type-element-values mb-3 relative' key={obj[0]}>
                                              {obj[1] as string}
                                              <button 
                                                type='button'
                                                className='delete-btn' 
                                                title='Remove value'
                                                onClick={(e) => handleDeleteValues(e.currentTarget as HTMLButtonElement)}
                                              >
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="size-7">
                                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                                </svg>
                                              </button>
                                            </span>
                                          )
                                        : null
                                      : null
                                    }
                                    </div>
                                    {
                                      element.type !== 'date_time' && element.type !== 'number' ?
                                        <input id={`${type.system.codename}-${element.codename}-input`} type='text' className='basis-full type-filters mb-1.5' onKeyDownCapture={(e) => { e.key === 'Enter' ? handleEnterPress(e) : null }} />
                                      :
                                      <div className='basis-full flex flex-wrap num-filter-container'>
                                        <input id={`${type.system.codename}-${element.codename}-input`} ref={createRef} type={element.type === 'date_time' ? 'date' : 'number'} className={`basis-full type-filters mb-1.5`} onKeyDownCapture={(e) => { e.key === 'Enter' ? handleEnterPress(e) : null }} />
                                        <div id={`${type.system.codename}-${element.codename}-range-container`} className='basis-full hidden flex-wrap'>
                                          <p className='basis-full text-left mb-1.5 py-[0.25rem] px-[0.5rem] text-[14px]'>and</p>
                                          <input id={`${element.codename}-range`}  type={element.type === 'date_time' ? 'date' : 'number'} className='basis-full type-filters mb-3' />
                                        </div>
                                      </div>
                                    }
                                    {
                                      element.type === 'modular_content' || element.type === 'multiple_choice' || element.type === 'subpages' || element.type === 'taxonomy'
                                      ?
                                        <button id={`${type.system.codename}-${element.codename}-add-btn`} type='button' className='hidden btn continue-btn place-self-end mt-3 mb-3' onClick={(e) => handleAddValues(e.target as HTMLButtonElement)}>
                                          Add value
                                        </button>
                                      : null
                                    }
                                  </div>
                                : null
                              )
                            }
                          </div>
                        )
                        : <p>No content types found.</p>
                      }
                    </div>
                  </fieldset>
                </div>
              </details>
            </fieldset>
            {/* Additional data options */}
            <fieldset className='basis-full flex flex-wrap mb-6'>
              <details id='additional-data-options-container' className='basis-full'>
                <summary>
                  <div className='relative basis-full'>
                    <legend className='font-bold text-[16px] text-left section-heading'>
                      Item details
                      <span className='tooltip-icon' title="The base content export only includes each item's content, but the following options can be selected to include various item metadata with each exported item.">ⓘ</span>
                    </legend>
                  </div>
                </summary>
                <div className='basis-full flex mb-3 pl-10'>
                  <label htmlFor='select-all-data' className='input-container flex place-items-center'>
                    <input type='checkbox' className='mr-[8px] accent-(--purple)' id='select-all-data' value='select-all-data'/>
                    Select all
                  </label>
                </div>
                <div className='flex flex-wrap basis-full pl-18'>
                  <div id='item-id-container' className='flex flex-wrap basis-full'>
                    <div className='flex flex-wrap basis-full mb-3'>
                      <label htmlFor='item-id' className='input-container flex place-items-center mb-1.5'>
                        <input type='checkbox' className='additional-data-options mr-[8px] accent-(--purple)' id='item-id' value='item-id'/>
                        ID
                      </label>
                    </div>
                  </div>
                  <div id='item-name-container' className='flex flex-wrap basis-full'>
                    <div className='flex flex-wrap basis-full mb-3'>
                      <label htmlFor='item-name' className='input-container flex place-items-center mb-1.5'>
                        <input type='checkbox' className='additional-data-options mr-[8px] accent-(--purple)' id='item-name' value='item-name'/>
                        Name
                      </label>
                    </div>
                  </div>
                  <div id='item-codename-container' className='flex flex-wrap basis-full'>
                    <div className='flex flex-wrap basis-full mb-3'>
                      <label htmlFor='item-codename' className='input-container flex place-items-center mb-1.5'>
                        <input type='checkbox' className='additional-data-options mr-[8px] accent-(--purple)' id='item-codename' value='item-codename'/>
                        Codename
                      </label>
                    </div>
                  </div>
                  <div id='item-collection-container' className='flex flex-wrap basis-full'>
                    <div className='flex flex-wrap basis-full mb-3'>
                      <label htmlFor='item-collection' className='input-container flex place-items-center mb-1.5'>
                        <input type='checkbox' className='additional-data-options mr-[8px] accent-(--purple)' id='item-collection' value='item-collection'/>
                        Collection
                      </label>
                    </div>
                  </div>
                  <div id='item-language-container' className='flex flex-wrap basis-full'>
                    <div className='flex flex-wrap basis-full mb-3'>
                      <label htmlFor='item-language' className='input-container flex place-items-center mb-1.5'>
                        <input type='checkbox' className='additional-data-options mr-[8px] accent-(--purple)' id='item-language' value='item-language'/>
                        Language
                      </label>
                    </div>
                  </div>
                  <div id='item-type-container' className='flex flex-wrap basis-full'>
                    <div className='flex flex-wrap basis-full mb-3'>
                      <label htmlFor='item-type' className='input-container flex place-items-center mb-1.5'>
                        <input type='checkbox' className='additional-data-options mr-[8px] accent-(--purple)' id='item-type' value='item-type'/>
                        Content type
                      </label>
                    </div>
                  </div>
                  <div id='item-last-modified-container' className='flex flex-wrap basis-full'>
                    <div className='flex flex-wrap basis-full mb-3'>
                      <label htmlFor='item-lastModified' className='input-container flex place-items-center mb-1.5'>
                        <input type='checkbox' className='additional-data-options mr-[8px] accent-(--purple)' id='item-lastModified' value='item-lastModified'/>
                        Last modified date
                      </label>
                    </div>
                  </div>
                  <div id='item-workflow-container' className='flex flex-wrap basis-full'>
                    <div className='flex flex-wrap basis-full mb-3'>
                      <label htmlFor='item-workflow' className='input-container flex place-items-center mb-1.5'>
                        <input type='checkbox' className='additional-data-options mr-[8px] accent-(--purple)' id='item-workflow' value='item-workflow'/>
                        Workflow
                      </label>
                    </div>
                  </div>
                  <div id='item-workflow-step-container' className='flex flex-wrap basis-full'>
                    <div className='flex flex-wrap basis-full mb-6'>
                      <label htmlFor='item-workflowStep' className='input-container flex place-items-center mb-1.5'>
                        <input type='checkbox' className='additional-data-options mr-[8px] accent-(--purple)' id='item-workflowStep' value='item-workflowStep'/>
                        Workflow step
                      </label>
                    </div>
                  </div>
                </div>
              </details>
            </fieldset>
            {/* File type */}
            <fieldset className='basis-full flex flex-wrap border-none mb-6'>
              <div className='basis-full flex mb-3 relative'>
                <legend className='font-bold text-[16px]'>
                  File type
                  <span className='tooltip-icon' title='If you choose Excel, then your selected content types will be organized into their own worksheets and exported within a single workbook. If you choose CSV, then your selected content types will be contained within their own CSV files, and exported together as a ZIP file.'>ⓘ</span>
                </legend>
                <p id='file-type-error' className='hidden absolute left-[191.391px] top-0 items-stretch rounded-lg overflow-hidden'>
                  <span className='bg-(--red) text-white px-2 py-[0.25rem] inline-flex items-center flex-shrink-0 message-icon-section'>
                    <span className='error-icon'>⚠</span>
                  </span>
                  <span className='bg-gray-100 text-black px-2 py-[0.25rem] inline-flex items-center'>
                    Please select a file type.
                  </span>
                </p>
              </div>
              <div className='flex mb-3 basis-full'>
                <label htmlFor='excel-radio-btn' className='input-container flex place-items-center'>
                  <input type='radio' id='excel-radio-btn' className='mr-[8px] accent-(--purple)' name='file-type' value={'excel'} />
                  Excel
                </label>
              </div>
              <div className='flex mb-3 basis-full'>
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
                  <input type='text' id='environment-id' name='environment-id' />
                  <p id='environment-id-error' className='hidden absolute top-0 left-[160px] items-stretch rounded-lg overflow-hidden'>
                  <span className='bg-(--red) text-white px-2 py-[0.25rem] inline-flex items-center flex-shrink-0 message-icon-section'>
                    <span className='error-icon'>⚠</span>
                  </span>
                  <span className='bg-gray-100 text-black px-2 py-[0.25rem] inline-flex items-center'>
                    {environmentIdErrorText}
                  </span>
                </p>
                </div>
                : null
              }
              <div className='basis-full relative flex flex-wrap'>
                <label id='api-key-label' htmlFor='api-key' className='basis-full text-left mb-3 font-bold focus:border-color-(--orange)'>
                  Delivery Preview API key
                  <span className='tooltip-icon' title='Your key must have Content Preview enabled. If your environment has Secure Access enabled, then your key must have Secure Access enabled as well.'>ⓘ</span>
                </label>
                <input type='text' id='api-key' name='api-key' />
                <p id='api-key-error' className='hidden absolute top-0 left-[230px] items-stretch rounded-lg overflow-hidden'>
                  <span className='bg-(--red) text-white px-2 py-[0.25rem] inline-flex items-center flex-shrink-0 message-icon-section'>
                    <span className='error-icon'>⚠</span>
                  </span>
                  <span className='bg-gray-100 text-black px-2 py-[0.25rem] inline-flex items-center'>
                    {apiKeyErrorText}
                  </span>
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