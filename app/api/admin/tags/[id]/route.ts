import { auth } from "@/auth";
import type { Prisma } from "@/lib/generated/prisma";
import { prisma } from "@/lib/prisma";
import { TagUpdateSchema } from "@/lib/validations";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// GET /api/admin/tags/[id]
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const session = await auth();
		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { id } = await params;
		const tag = await prisma.tag.findUnique({
			where: { id },
			include: {
				_count: {
					select: {
						posts: true,
					},
				},
			},
		});

		if (!tag) {
			return NextResponse.json({ error: "Tag not found" }, { status: 404 });
		}

		return NextResponse.json(tag);
	} catch (error) {
		console.error("Error fetching tag:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

// PATCH /api/admin/tags/[id]
export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const session = await auth();
		if (!session?.user?.id) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { id } = await params;
		const body = await request.json();

		// Validate input
		const TagUpdatePayloadSchema = TagUpdateSchema.omit({ id: true });
		const validatedFields = TagUpdatePayloadSchema.safeParse(body);
		if (!validatedFields.success) {
			return NextResponse.json(
				{ error: "Invalid input", details: validatedFields.error.format() },
				{ status: 400 },
			);
		}

		const { name, slug } = validatedFields.data;

		// Check if name or slug already exists (excluding current tag)
		if (name || slug) {
			const existingTag = await prisma.tag.findFirst({
				where: {
					AND: [
						{ NOT: { id } },
						{
							OR: [...(name ? [{ name }] : []), ...(slug ? [{ slug }] : [])],
						},
					],
				},
			});

			if (existingTag) {
				return NextResponse.json(
					{ error: "A tag with this name or slug already exists" },
					{ status: 400 },
				);
			}
		}

		const updateData: Prisma.TagUpdateInput = {};
		if (name !== undefined) updateData.name = name;
		if (slug !== undefined) updateData.slug = slug;

		const tag = await prisma.tag.update({
			where: { id },
			data: updateData,
			include: {
				_count: {
					select: {
						posts: true,
					},
				},
			},
		});

		return NextResponse.json(tag);
	} catch (error) {
		console.error("Error updating tag:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

// DELETE /api/admin/tags/[id]
export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const session = await auth();
		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { id } = await params;
		const tag = await prisma.tag.findUnique({
			where: { id },
			include: {
				_count: {
					select: {
						posts: true,
					},
				},
			},
		});

		if (!tag) {
			return NextResponse.json({ error: "Tag not found" }, { status: 404 });
		}

		// Prevent deletion if tag has posts
		if (tag._count.posts > 0) {
			return NextResponse.json(
				{ error: "Cannot delete tag with associated posts" },
				{ status: 400 },
			);
		}

		await prisma.tag.delete({
			where: { id },
		});

		return NextResponse.json({ message: "Tag deleted successfully" });
	} catch (error) {
		console.error("Error deleting tag:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
