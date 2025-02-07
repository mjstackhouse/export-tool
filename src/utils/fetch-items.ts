import { MultipleItemsQuery } from '@kontent-ai/delivery-sdk';
import createDeliveryClientContainer from './delivery-client';

type LastModified = {
  value: Array<string>,
  filter: string
}

const lastModifiedFilterMap = {
  'equals': 'equalsFilter',
  'does not equal': 'notEqualsFilter',
  'is before': 'lessThanFilter',
  'is before or the same as': 'lessThanOrEqualToFilter',
  'is after': 'greaterThanFilter',
  'is after or the same as': 'greaterThanOrEqualFilter',
  'is in the range of': 'rangeFilter'
}

export default async function fetchItems(environmentId: string, apiKey: string, types: Array<string>, language: string, workflowStep: string, lastModified?: LastModified, itemName?: string, collection?: string) {

  let deliveryClient = createDeliveryClientContainer(environmentId, apiKey);

  let query = deliveryClient.items()
      .orderByAscending('system.type')
      .types(types)
      .languageParameter(language)
      .equalsFilter('system.language', language)
  
  if (lastModified) {
    if (!lastModified.value.includes('')) {
      const filterName = lastModifiedFilterMap[lastModified.filter as keyof typeof lastModifiedFilterMap];
    
      type FilterMethod = (
        element: string,
        value: string | Array<string>
      ) => MultipleItemsQuery;

      if (filterName !== 'rangeFilter') {
        query = (query as unknown as Record<string, FilterMethod>)[filterName]('system.last_modified', lastModified.value[0]);
      }
      else {
        query = query[filterName]('system.last_modified', lastModified.value[0], lastModified.value[1]);
      }
    }
  }

  if (itemName) query = query.equalsFilter('system.name', itemName);
  if (collection) query = query.equalsFilter('system.collection', collection);

  if (workflowStep === 'published') {
    query = query.equalsFilter('system.workflow_step', 'published');
    query = query.queryConfig({ usePreviewMode: false, useSecuredMode: true });
  } 
  else if (workflowStep === 'draft') query = query.equalsFilter('system.workflow_step', 'draft');

  const response = await query.toPromise();

  return response.data;
}