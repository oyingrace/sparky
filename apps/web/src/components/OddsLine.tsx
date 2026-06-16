type OddsLineProps = {
  yesPool: string;
  noPool: string;
  yesToNo?: string | null;
};

export function OddsLine({ yesPool, noPool, yesToNo }: OddsLineProps) {
  const yes = (Number(yesPool) / 1e9).toFixed(4);
  const no = (Number(noPool) / 1e9).toFixed(4);

  return (
    <div className="odds">
      <span className="odds__label">Pools</span>
      YES {yes} · NO {no} SUI
      {yesToNo && (
        <>
          {" "}
          · <span className="odds__label">Implied</span> 1:{yesToNo}
        </>
      )}
    </div>
  );
}
