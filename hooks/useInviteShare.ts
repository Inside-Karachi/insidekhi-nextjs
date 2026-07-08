import { useState, useCallback } from "react";
import type {
  UseInviteShareReturn,
  CreateInvitationResponse,
  CreateShareRequest,
  CreateShareResponse,
  UploadScreenshotResponse,
  PendingInvitation,
  PendingShare,
  InviteShareStats,
} from "@/types/invite-share.types";

export function useInviteShare(): UseInviteShareReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<InviteShareStats | null>(null);

  const createInvitation = useCallback(
    async (email: string): Promise<CreateInvitationResponse> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/invitations/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invitee_email: email }),
        });

        const data: CreateInvitationResponse = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to create invitation");
        }

        return data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to create invitation";
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const getPendingInvitations = useCallback(async (): Promise<
    PendingInvitation[]
  > => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/invitations/pending");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch invitations");
      }

      return data.invitations || [];
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch invitations";
      setError(errorMessage);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createShare = useCallback(
    async (data: CreateShareRequest): Promise<CreateShareResponse> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/shares/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        const result: CreateShareResponse = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || "Failed to create share");
        }

        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to create share";
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const uploadScreenshot = useCallback(
    async (shareId: number, file: File): Promise<UploadScreenshotResponse> => {
      setIsLoading(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("share_id", shareId.toString());

        const response = await fetch("/api/shares/upload-screenshot", {
          method: "POST",
          body: formData,
        });

        const data: UploadScreenshotResponse = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed to upload screenshot");
        }

        return data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to upload screenshot";
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const getPendingShares = useCallback(async (): Promise<PendingShare[]> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/shares/pending");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch shares");
      }

      return data.shares || [];
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch shares";
      setError(errorMessage);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshStats = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/invitations/stats");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch stats");
      }

      setStats(data.stats || null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch stats";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    error,
    stats,
    createInvitation,
    getPendingInvitations,
    createShare,
    uploadScreenshot,
    getPendingShares,
    refreshStats,
  };
}
