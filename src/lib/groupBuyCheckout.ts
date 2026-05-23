interface GroupBuyDeliveryAddress {
  full_name?: string | null;
  phone?: string | null;
  address_line1?: string | null;
  city?: string | null;
  country?: string | null;
}

interface GroupBuyDeliveryValidationInput {
  address?: GroupBuyDeliveryAddress | null;
  email?: string | null;
}

const GROUP_BUY_ADDRESS_SETUP_PATH = '/profile?tab=addresses';

function hasText(value: string | null | undefined) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function getGroupBuyAddressSetupPath() {
  return GROUP_BUY_ADDRESS_SETUP_PATH;
}

export function hasRequiredGroupBuyDeliveryDetails({
  address,
  email,
}: GroupBuyDeliveryValidationInput) {
  return (
    !!address &&
    hasText(address.full_name) &&
    hasText(address.phone) &&
    hasText(address.address_line1) &&
    hasText(address.city) &&
    hasText(address.country) &&
    hasText(email)
  );
}
