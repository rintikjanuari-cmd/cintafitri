
import * as XLSX from 'xlsx';
import { SupabaseConfig } from '../types';

export interface ExportResult {
  accountLabel: string;
  data: any[];
  success: boolean;
  error?: string;
}

export const supabaseExportService = {
  /**
   * Fetches available table names from a Supabase account
   */
  detectTables: async (config: SupabaseConfig): Promise<string[]> => {
    if (!config.url || !config.key) return [];
    try {
      // Query information_schema.tables via Supabase REST API (PostgREST)
      // Note: This requires the 'anon' role to have access to information_schema or a custom RPC
      // Since direct information_schema access is often restricted, we try a common RPC or just return defaults
      // A better way is to try to fetch from common tables or use the Supabase Management API if available.
      // For this implementation, we'll try to fetch from information_schema.tables
      const response = await fetch(`${config.url}/rest/v1/rpc/get_tables`, {
        method: 'POST',
        headers: {
          'apikey': config.key,
          'Authorization': `Bearer ${config.key}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        return await response.json();
      }

      // Fallback: Try information_schema directly
      const fallbackResponse = await fetch(`${config.url}/rest/v1/?apikey=${config.key}`, {
        method: 'GET',
        headers: { 'apikey': config.key }
      });
      
      if (fallbackResponse.ok) {
        const swagger = await fallbackResponse.json();
        if (swagger.definitions) {
          return Object.keys(swagger.definitions);
        }
      }
      
      return ['patients', 'records', 'users']; // Default common tables
    } catch (error) {
      console.error('Table detection failed:', error);
      return ['patients', 'records', 'users'];
    }
  },

  /**
   * Fetches data from multiple Supabase accounts and exports to a single Excel file with pagination
   */
  exportCollectiveData: async (configs: SupabaseConfig[], tableName: string = 'patients', onProgress?: (msg: string) => void) => {
    const results: ExportResult[] = [];
    const PAGE_SIZE = 1000;

    for (const config of configs) {
      if (!config.url || !config.key) continue;
      
      if (onProgress) onProgress(`Mengambil data dari: ${config.label || config.url}...`);

      try {
        let allData: any[] = [];
        let page = 0;
        let hasMore = true;

        while (hasMore) {
          const rangeStart = page * PAGE_SIZE;
          const rangeEnd = rangeStart + PAGE_SIZE - 1;

          const response = await fetch(`${config.url}/rest/v1/${tableName}?select=*`, {
            method: 'GET',
            headers: {
              'apikey': config.key,
              'Authorization': `Bearer ${config.key}`,
              'Content-Type': 'application/json',
              'Range': `${rangeStart}-${rangeEnd}`
            }
          });

          if (!response.ok) {
            if (response.status === 404) throw new Error(`Tabel '${tableName}' tidak ditemukan.`);
            throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
          }

          const data = await response.json();
          allData = [...allData, ...data];
          
          if (data.length < PAGE_SIZE) {
            hasMore = false;
          } else {
            page++;
            if (onProgress) onProgress(`Mengambil data dari: ${config.label} (Halaman ${page + 1})...`);
          }
        }

        results.push({
          accountLabel: config.label || config.url,
          data: allData,
          success: true
        });
      } catch (error: any) {
        results.push({
          accountLabel: config.label || config.url,
          data: [],
          success: false,
          error: error.message || 'Unknown error'
        });
      }
    }

    // Create Excel Workbook
    const wb = XLSX.utils.book_new();

    // Add a summary sheet
    const summaryData = results.map(r => ({
      'Account Label': r.accountLabel,
      'Status': r.success ? 'Success' : 'Failed',
      'Record Count': r.data.length,
      'Error': r.error || '-'
    }));
    const summaryWs = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

    // Add individual sheets for each successful account
    results.forEach(r => {
      if (r.success && r.data.length > 0) {
        const ws = XLSX.utils.json_to_sheet(r.data);
        // Sheet names must be <= 31 chars and unique
        const sheetName = r.accountLabel.substring(0, 30).replace(/[:\\\/\?\*\[\]]/g, '_');
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      }
    });

    // Generate and download the file
    const fileName = `TCM_Collective_Export_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);

    return results;
  }
};
