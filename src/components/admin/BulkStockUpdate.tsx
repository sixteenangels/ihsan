import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, Download, FileSpreadsheet, Check, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface CSVRow {
  sku: string;
  stock: number;
  status: 'pending' | 'success' | 'error';
  message?: string;
}

export function BulkStockUpdate() {
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const parseCSV = (text: string): CSVRow[] => {
    const lines = text.trim().split('\n');
    const rows: CSVRow[] = [];
    
    // Skip header if present
    const startIndex = lines[0].toLowerCase().includes('sku') ? 1 : 0;
    
    for (let i = startIndex; i < lines.length; i++) {
      const [sku, stockStr] = lines[i].split(',').map(s => s.trim().replace(/"/g, ''));
      const stock = parseInt(stockStr, 10);
      
      if (sku && !isNaN(stock) && stock >= 0) {
        rows.push({ sku, stock, status: 'pending' });
      } else if (sku) {
        rows.push({ sku, stock: 0, status: 'error', message: 'Invalid stock value' });
      }
    }
    
    return rows;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCSV(text);
      setCsvData(parsed);
      toast.success(`Loaded ${parsed.length} rows from CSV`);
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const template = 'sku,stock\nSKU001,100\nSKU002,50\nSKU003,25';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stock_update_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const processUpdates = async () => {
    setIsProcessing(true);
    const updatedData = [...csvData];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < updatedData.length; i++) {
      const row = updatedData[i];
      if (row.status === 'error') {
        errorCount++;
        continue;
      }

      try {
        const { data, error } = await supabase
          .from('product_variants')
          .update({ stock: row.stock })
          .eq('sku', row.sku)
          .select('id');

        if (error) throw error;
        
        if (data && data.length > 0) {
          updatedData[i] = { ...row, status: 'success', message: 'Updated' };
          successCount++;
        } else {
          updatedData[i] = { ...row, status: 'error', message: 'SKU not found' };
          errorCount++;
        }
      } catch (err) {
        updatedData[i] = { ...row, status: 'error', message: 'Update failed' };
        errorCount++;
      }

      setCsvData([...updatedData]);
    }

    setIsProcessing(false);
    queryClient.invalidateQueries({ queryKey: ['admin-low-stock-detailed'] });
    
    if (successCount > 0) {
      toast.success(`Updated ${successCount} variants successfully`);
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} rows failed to update`);
    }
  };

  const clearData = () => {
    setCsvData([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Bulk Stock Update
        </CardTitle>
        <CardDescription>
          Upload a CSV file with SKU and stock columns to update multiple variants at once
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Upload Section */}
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <Input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="cursor-pointer"
            />
          </div>
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </Button>
        </div>

        {/* Preview Table */}
        {csvData.length > 0 && (
          <>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>New Stock</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {csvData.slice(0, 50).map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono">{row.sku}</TableCell>
                      <TableCell>{row.stock}</TableCell>
                      <TableCell>
                        {row.status === 'pending' && (
                          <Badge variant="outline">Pending</Badge>
                        )}
                        {row.status === 'success' && (
                          <Badge className="bg-green-500">
                            <Check className="h-3 w-3 mr-1" />
                            {row.message}
                          </Badge>
                        )}
                        {row.status === 'error' && (
                          <Badge variant="destructive">
                            <X className="h-3 w-3 mr-1" />
                            {row.message}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {csvData.length > 50 && (
                <div className="p-3 text-center text-sm text-muted-foreground bg-muted">
                  Showing first 50 of {csvData.length} rows
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button 
                onClick={processUpdates} 
                disabled={isProcessing || csvData.every(r => r.status !== 'pending')}
              >
                <Upload className="h-4 w-4 mr-2" />
                {isProcessing ? 'Processing...' : `Update ${csvData.filter(r => r.status === 'pending').length} Variants`}
              </Button>
              <Button variant="outline" onClick={clearData}>
                Clear
              </Button>
            </div>

            {/* Summary */}
            <div className="flex gap-4 text-sm">
              <span className="text-muted-foreground">
                Total: {csvData.length}
              </span>
              <span className="text-green-600">
                Success: {csvData.filter(r => r.status === 'success').length}
              </span>
              <span className="text-destructive">
                Errors: {csvData.filter(r => r.status === 'error').length}
              </span>
            </div>
          </>
        )}

        {csvData.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Upload a CSV file to get started</p>
            <p className="text-sm mt-2">Format: sku,stock (one per line)</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
