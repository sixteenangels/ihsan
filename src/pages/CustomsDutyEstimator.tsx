import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calculator, AlertTriangle, Info } from 'lucide-react';
import { useCurrency } from '@/hooks/useCurrency';

const categories = [
  { value: 'electronics', label: 'Electronics (Phones, Laptops)', dutyRate: 20, vatRate: 15, nhilRate: 2.5, getfundRate: 2.5 },
  { value: 'clothing', label: 'Clothing & Textiles', dutyRate: 20, vatRate: 15, nhilRate: 2.5, getfundRate: 2.5 },
  { value: 'cosmetics', label: 'Cosmetics & Beauty', dutyRate: 20, vatRate: 15, nhilRate: 2.5, getfundRate: 2.5 },
  { value: 'food', label: 'Food & Beverages', dutyRate: 20, vatRate: 0, nhilRate: 2.5, getfundRate: 2.5 },
  { value: 'accessories', label: 'Accessories & Jewellery', dutyRate: 20, vatRate: 15, nhilRate: 2.5, getfundRate: 2.5 },
  { value: 'home', label: 'Home & Kitchen', dutyRate: 20, vatRate: 15, nhilRate: 2.5, getfundRate: 2.5 },
  { value: 'toys', label: 'Toys & Games', dutyRate: 20, vatRate: 15, nhilRate: 2.5, getfundRate: 2.5 },
  { value: 'auto', label: 'Auto Parts', dutyRate: 10, vatRate: 15, nhilRate: 2.5, getfundRate: 2.5 },
];

const origins = [
  { value: 'china', label: 'China' },
  { value: 'usa', label: 'United States' },
  { value: 'uk', label: 'United Kingdom' },
  { value: 'turkey', label: 'Turkey' },
  { value: 'dubai', label: 'UAE / Dubai' },
  { value: 'india', label: 'India' },
  { value: 'other', label: 'Other' },
];

export default function CustomsDutyEstimator() {
  const { formatPrice } = useCurrency();
  const [productValue, setProductValue] = useState('');
  const [shippingCost, setShippingCost] = useState('');
  const [category, setCategory] = useState('');
  const [origin, setOrigin] = useState('');
  const [result, setResult] = useState<any>(null);

  const handleCalculate = () => {
    const cat = categories.find(c => c.value === category);
    if (!cat || !productValue) return;

    const cifValue = Number(productValue) + Number(shippingCost || 0);
    const importDuty = cifValue * (cat.dutyRate / 100);
    const dutyPlusValue = cifValue + importDuty;
    const vat = dutyPlusValue * (cat.vatRate / 100);
    const nhil = dutyPlusValue * (cat.nhilRate / 100);
    const getfund = dutyPlusValue * (cat.getfundRate / 100);
    const ecowasLevy = cifValue * 0.005; // 0.5%
    const examLevy = cifValue * 0.01; // 1%
    const totalDuty = importDuty + vat + nhil + getfund + ecowasLevy + examLevy;

    setResult({
      cifValue,
      importDuty,
      vat,
      nhil,
      getfund,
      ecowasLevy,
      examLevy,
      totalDuty,
      totalCost: cifValue + totalDuty,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8 max-w-2xl">
        <div className="flex items-center gap-3 mb-8">
          <Calculator className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-3xl font-bold font-serif text-foreground">Customs Duty Estimator</h1>
            <p className="text-muted-foreground">Estimate import duties for items shipped to Ghana</p>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Enter Product Details</CardTitle>
            <CardDescription>All values should be in Ghana Cedis (₵)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Product Value (₵)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 500"
                  value={productValue}
                  onChange={(e) => setProductValue(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Shipping Cost (₵)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 100"
                  value={shippingCost}
                  onChange={(e) => setShippingCost(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Product Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Country of Origin</Label>
                <Select value={origin} onValueChange={setOrigin}>
                  <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                  <SelectContent>
                    {origins.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleCalculate} disabled={!productValue || !category} className="w-full">
              <Calculator className="h-4 w-4 mr-2" />
              Calculate Estimated Duty
            </Button>
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Estimated Breakdown
                <Badge variant="secondary">Estimate Only</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">CIF Value (Product + Shipping)</span>
                <span className="font-medium text-foreground">{formatPrice(result.cifValue)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Import Duty (20%)</span>
                <span className="font-medium text-foreground">{formatPrice(result.importDuty)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">VAT (15%)</span>
                <span className="font-medium text-foreground">{formatPrice(result.vat)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">NHIL (2.5%)</span>
                <span className="font-medium text-foreground">{formatPrice(result.nhil)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">GETFund Levy (2.5%)</span>
                <span className="font-medium text-foreground">{formatPrice(result.getfund)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">ECOWAS Levy (0.5%)</span>
                <span className="font-medium text-foreground">{formatPrice(result.ecowasLevy)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Examination Levy (1%)</span>
                <span className="font-medium text-foreground">{formatPrice(result.examLevy)}</span>
              </div>
              <div className="flex justify-between py-3 bg-destructive/5 -mx-6 px-6 rounded-lg">
                <span className="font-semibold text-destructive">Total Estimated Duty</span>
                <span className="font-bold text-destructive text-lg">{formatPrice(result.totalDuty)}</span>
              </div>
              <div className="flex justify-between py-3 bg-primary/5 -mx-6 px-6 rounded-lg">
                <span className="font-semibold text-primary">Total Estimated Cost</span>
                <span className="font-bold text-primary text-lg">{formatPrice(result.totalCost)}</span>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mt-6">
          <CardContent className="pt-6 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-foreground font-medium mb-1">Disclaimer</p>
              <p className="text-xs text-muted-foreground">
                This is an estimate only. Actual customs duties may vary based on Ghana Customs Service (GCS) classification,
                exchange rates, and additional fees. For high-value shipments, we recommend consulting a customs broker.
                Ihsan handles all customs clearance for orders placed through our platform.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
