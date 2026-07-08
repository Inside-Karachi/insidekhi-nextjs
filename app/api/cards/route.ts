import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bankId = searchParams.get("bankId");

    if (!bankId) {
      return NextResponse.json(
        { error: "bankId parameter is required" },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabase();

    // First, try to find the bank - try numeric ID first, then code
    let bankQuery = supabase.from("banks").select("id, code");

    const bankIdNum = parseInt(bankId, 10);
    if (!isNaN(bankIdNum)) {
      // If it's a number, query by ID first
      bankQuery = bankQuery.eq("id", bankIdNum);
    } else {
      // If it's a string code, query by code
      bankQuery = bankQuery.eq("code", bankId);
    }

    const { data: bank, error: bankError } = await bankQuery.single();

    if (bankError || !bank) {
      return NextResponse.json({ error: "Bank not found" }, { status: 400 });
    }

    const bankCode = bank.code || `bank-${bank.id}`;

    // Fetching cards for bank_id

    const { data: cards, error } = await supabase
      .from("card_variants")
      .select("*")
      .eq("bank_id", bank.id)
      .eq("is_active", true)
      .order("card_tier", { ascending: true })
      .order("card_name", { ascending: true });

    if (error) {
      console.error("Supabase error fetching cards:", error);
      return NextResponse.json(
        { error: "Failed to fetch cards", details: error.message },
        { status: 500 }
      );
    }

    // Return full card data for components that need complete card info
    const cardData =
      cards?.map((card) => ({
        id: card.id,
        card_name: card.card_name,
        card_type: card.card_type,
        card_network: card.card_network,
        card_tier: card.card_tier,
        image_filename: card.image_filename,
      })) || [];

    return NextResponse.json({
      success: true,
      cards: cardData,
      count: cardData.length,
      bankCode,
    });
  } catch (error) {
    console.error("API error fetching cards:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
