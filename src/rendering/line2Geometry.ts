import type { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import type { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

export type Line2GeometryUpdateOptions = {
	replaceGeometryOnUpdate: boolean;
};

const getLineGeometryDistance = (geometry: LineGeometry) => {
	const distanceAttribute = geometry.getAttribute("instanceDistanceEnd");
	if (!distanceAttribute || distanceAttribute.count === 0) {
		return 0;
	}

	return distanceAttribute.getX(distanceAttribute.count - 1);
};

const syncDashedLineEndpoint = (
	material: LineMaterial,
	lineDistance: number,
) => {
	if (!("USE_DASH" in material.defines) || lineDistance <= 0) {
		return;
	}

	const dashPeriod = material.dashSize + material.gapSize;
	if (dashPeriod <= 0) {
		return;
	}

	const endpointPhase = material.dashSize * 0.5;
	material.dashOffset =
		(((endpointPhase - lineDistance) % dashPeriod) + dashPeriod) % dashPeriod;
};

export const updateLine2Geometry = (
	line: Line2,
	geometry: LineGeometry,
	positions: number[],
	options: Line2GeometryUpdateOptions,
): LineGeometry => {
	if (positions.length === 0) {
		line.visible = false;
		return geometry;
	}

	const nextGeometry = options.replaceGeometryOnUpdate
		? new LineGeometry()
		: geometry;
	nextGeometry.setPositions(positions);

	if (options.replaceGeometryOnUpdate) {
		geometry.dispose();
		line.geometry = nextGeometry;
	}

	line.computeLineDistances();
	syncDashedLineEndpoint(line.material, getLineGeometryDistance(nextGeometry));
	line.visible = positions.length >= 6;
	return nextGeometry;
};

export const updateColoredLine2Geometry = (
	line: Line2,
	geometry: LineGeometry,
	positions: number[],
	colors: number[],
	options: Line2GeometryUpdateOptions,
): LineGeometry => {
	const nextGeometry = updateLine2Geometry(line, geometry, positions, options);

	if (positions.length > 0) {
		nextGeometry.setColors(colors);
	}

	return nextGeometry;
};
