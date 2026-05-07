import { LowStockAlerts } from './LowStockAlerts';
import { BulkStockUpdate } from './BulkStockUpdate';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { AlertTriangle, Upload } from 'lucide-react';

export function StockManagement() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Stock Management</h1>
        <p className="text-muted-foreground">Monitor low stock alerts and update inventory</p>
      </div>

      <Tabs defaultValue="alerts" className="space-y-6">
        <ScrollArea className="w-full whitespace-nowrap">
          <TabsList className="inline-flex h-auto min-w-max gap-2 p-1">
            <TabsTrigger value="alerts" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              Low Stock Alerts
            </TabsTrigger>
            <TabsTrigger value="bulk" className="gap-2">
              <Upload className="h-4 w-4" />
              Bulk Update
            </TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        <TabsContent value="alerts">
          <LowStockAlerts />
        </TabsContent>

        <TabsContent value="bulk">
          <BulkStockUpdate />
        </TabsContent>
      </Tabs>
    </div>
  );
}
