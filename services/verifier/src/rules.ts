export type RuleCheckResult = {
  passed: boolean;
  flags: string[];
};

export type RuleCheckInput = {
  proofType: number;
  proofBytes: Buffer;
  metadata?: {
    submittedAtMs?: number;
    deadlineMs?: number;
    expectedLat?: number;
    expectedLng?: number;
    gpsLat?: number;
    gpsLng?: number;
    gpsRadiusMeters?: number;
    deviceId?: string;
    priorDeviceId?: string;
  };
};

const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];

function hasMagic(bytes: Buffer, magic: number[]): boolean {
  if (bytes.length < magic.length) return false;
  return magic.every((b, i) => bytes[i] === b);
}

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const r = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

/** Stage 1: deterministic rule checks (EXIF/GPS/timestamp/device). */
export function runRuleChecks(input: RuleCheckInput): RuleCheckResult {
  const flags: string[] = [];
  const { proofType, proofBytes, metadata } = input;

  if (proofBytes.length < 64) {
    flags.push("proof_too_small");
  }

  if (proofType === 0) {
    if (!hasMagic(proofBytes, JPEG_MAGIC) && !hasMagic(proofBytes, PNG_MAGIC)) {
      flags.push("invalid_image_magic");
    }
  }

  if (metadata?.submittedAtMs != null && metadata?.deadlineMs != null) {
    if (metadata.submittedAtMs > metadata.deadlineMs) {
      flags.push("timestamp_after_deadline");
    }
  }

  if (proofType === 1 && metadata) {
    const { expectedLat, expectedLng, gpsLat, gpsLng, gpsRadiusMeters = 500 } =
      metadata;
    if (
      expectedLat != null &&
      expectedLng != null &&
      gpsLat != null &&
      gpsLng != null
    ) {
      const dist = haversineMeters(expectedLat, expectedLng, gpsLat, gpsLng);
      if (dist > gpsRadiusMeters) {
        flags.push("gps_outside_radius");
      }
    } else if (gpsLat == null || gpsLng == null) {
      flags.push("gps_coordinates_missing");
    }
  }

  if (
    metadata?.deviceId &&
    metadata?.priorDeviceId &&
    metadata.deviceId !== metadata.priorDeviceId
  ) {
    flags.push("device_id_changed");
  }

  return { passed: flags.length === 0, flags };
}

export function shouldEscalateToLlm(rules: RuleCheckResult): boolean {
  return rules.flags.some((f) =>
    ["device_id_changed", "gps_outside_radius"].includes(f),
  );
}
