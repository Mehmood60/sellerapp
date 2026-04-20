'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { listings as listingsApi } from '@/lib/api';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/formatters';
import { useFormatMoney } from '@/components/PreferencesProvider';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, ExternalLink, Package } from 'lucide-react';
import type { Listing, ListingStatus } from '@/types';

const STATUS_VARIANT: Record<ListingStatus, 'success' | 'danger' | 'warning' | 'default'> = {
  ACTIVE:       'success',
  ENDED:        'danger',
  OUT_OF_STOCK: 'warning',
  DRAFT:        'default',
};

export default function ListingDetailPage() {
  const params      = useParams();
  const id          = params.id as string;
  const router      = useRouter();
  const formatMoney = useFormatMoney();

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    listingsApi.get(id)
      .then((res) => {
        const l = res.data as unknown as Listing;
        if (l.status === 'DRAFT') {
          router.replace(`/listings/${id}/edit`);
          return;
        }
        setListing(l);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load listing'))
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0f3460] border-t-transparent" />
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="space-y-4">
        <Link href="/listings" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-4 w-4" /> Back to listings
        </Link>
        <p className="text-red-500">{error ?? 'Listing not found.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/listings" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 flex-1">{listing.title}</h1>
        <Badge variant={STATUS_VARIANT[listing.status] ?? 'default'}>{listing.status}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Image */}
        <Card>
          <CardBody className="p-0">
            <div className="aspect-square relative bg-gray-100 rounded-xl overflow-hidden">
              {listing.images[0] ? (
                <Image
                  src={listing.images[0]}
                  alt={listing.title}
                  fill
                  className="object-cover"
                  sizes="50vw"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-300">
                  <Package className="h-16 w-16" />
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Details */}
        <div className="space-y-4">
          <Card>
            <CardBody className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Price</span>
                <span className="text-2xl font-bold text-[#0f3460]">{formatMoney(listing.price)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">SKU</span>
                <span className="font-mono text-xs">{listing.sku || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Available</span>
                <span className="font-semibold">{listing.quantity.available}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Sold</span>
                <span className="font-semibold">{listing.quantity.sold}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Condition</span>
                <span>{listing.condition || '—'}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-gray-500">Category</span>
                <span className="text-right text-xs leading-snug">
                  {listing.category.name
                    ? listing.category.name.split(':').join(' › ')
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Listed</span>
                <span>{formatDate(listing.listed_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Ends</span>
                <span>{formatDate(listing.ends_at)}</span>
              </div>
            </CardBody>
          </Card>

          {listing.listing_url && (
            <a
              href={listing.listing_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              View on eBay
            </a>
          )}
        </div>
      </div>

      {listing.description_snippet && (
        <Card>
          <CardHeader><h2 className="font-semibold text-sm">Description</h2></CardHeader>
          <CardBody>
            <p className="text-sm text-gray-600 leading-relaxed">{listing.description_snippet}</p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
