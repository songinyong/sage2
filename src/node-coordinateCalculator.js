// SAGE2 is available for use under the SAGE2 Software License
//
// University of Illinois at Chicago's Electronic Visualization Laboratory (EVL)
// and University of Hawai'i at Manoa's Laboratory for Advanced Visualization and
// Applications (LAVA)
//
// See full text, terms and conditions in the LICENSE.txt included file
//
// Copyright (c) 2014

/**
 * Calculate intersection of ray and cylinder for CAVE2
 *
 * @module server
 * @submodule coordinateCalculator
 */

// require variables to be declared
"use strict";

var max_y_error = 0.5;   // meters
var max_x_error = 0.005; // fractional

var radius = 6.477 / 2;
var radiansForDoor = 36 * Math.PI / 180;

var minY = 0.305;
var maxY = 2.625;

var position    = {};
var eulerAngles = {};
var screenPos   = {};
var wallOrigin	= {};
var wallDim		= {};

/**
 * CoordinateCalculator class
 *
 * @class CoordinateCalculator
 * @constructor
 */
function CoordinateCalculator() {
	position.x = 0;
	position.y = 0;
	position.z = 1;

	eulerAngles.x = 0;
	eulerAngles.y = 0;
	eulerAngles.z = 1;

	screenPos.x = 0.5;
	screenPos.y = 0.5;

	// Upper left corner of wall relative to tracking origin
	wallOrigin.x = -3.647;
	wallOrigin.y = 2.533;
	wallOrigin.z = 3.573;

	// Wall width and height in meters
	wallDim.x = 7.305;
	wallDim.y = 2.058;
}

/**
 * Calculate wand to screen intersection
 *
 * @method wandToCAVE2ScreenCoordinates
 * @param x {Number} wand x
 * @param y {Number} wand x
 * @param z {Number} wand x
 * @param rx {Number} ray x
 * @param ry {Number} ray y
 * @param rz {Number} ray z
 * @param rw {Number} ray w
 * @return {Object} screen coordinates .x and .y
 */
CoordinateCalculator.prototype.wandToCAVE2ScreenCoordinates = function(x, y, z, rx, ry, rz, rw) {
	// Quaternion to Euler ////////////////////////
	// Rotation matrix Q multiplied by reference vector (0,0,-1)
	// 		| 1 - 2y^2 - 2z^2 , 2xy - 2zw, 2xz + 2yw	|		|0	|
	// Q =	| 2xy + 2zw, 1 - 2x^2 - 2z^2, 2yz - 2xw		| * 	|0	|
	// 		| 2xz - 2yw, 2yz + 2xw, 1 - 2x^2 - 2y^2		|		|-1|
	eulerAngles.x = -1 * (2 * rx * rz + 2 * ry * rw);
	eulerAngles.y = -1 * (2 * ry * rz - 2 * rx * rw);
	eulerAngles.z = -1 * (1 - 2 * (rx * rx) - 2 * (ry * ry));

	if (rx * ry + rz * rw === 0.5) {
		// North pole
		eulerAngles.x = 2 * Math.atan2(rx, rw);
		eulerAngles.z = 0;
	} else if (rx * ry + rz * rw === -0.5) {
		// South pole
		eulerAngles.x = -2 * Math.atan2(rx, rw);
		eulerAngles.z = 0;
	}
	// QuaternionToEuler ends ///////////////////

	// Orientation is vertical
	if (eulerAngles.x === 0 && eulerAngles.z === 0) {
		screenPos.x = -1;
		screenPos.y = -1;
	} else {
		var h  = 0; // x-coordinate of the center of the circle
		var k  = 0; // z-coordinate of the center of the circle
		var ox = eulerAngles.x; // parametric slope of x, from orientation vector
		var oy = eulerAngles.y; // parametric slope of y, from orientation vector
		var oz = eulerAngles.z; // parametric slope of z, from orientation vector
		var r  = radius; // radius of cylinder

		// A * t^2 + B * t + C
		var A = ox * ox + oz * oz;
		var B = 2 * ox * x + 2 * oz * z - 2 * h * ox - 2 * k * oz;
		var C = x * x + z * z + h * h + k * k - r * r - 2 * h * x - 2 * k * z;

		if (A !== 0  && (B * B - 4 * A * C) >= 0) {
			var t1 = (-B + Math.sqrt(B * B - 4 * A * C)) / (2 * A);
			var t2 = (-B - Math.sqrt(B * B - 4 * A * C)) / (2 * A);
			var t = 0;
			if (t1 >= 0) {
				t = t1;
			} else if (t2 >= 0) {
				t = t2;
			} else {
				screenPos.x = -1;
				screenPos.y = -1;
			}
			var x_pos = ox * t + x;
			var y_pos = oy * t + y;
			var z_pos = oz * t + z;
			this.calculateCAVE2ScreenPos(x_pos, y_pos, z_pos);
		} else {
			screenPos.x = -1;
			screenPos.y = -1;
		}
	}
	return screenPos;
};

/**
 * Calculate screen coordinates
 *
 * @method calculateCAVE2ScreenPos
 * @param x {Number} wand x
 * @param y {Number} wand x
 * @param z {Number} wand x
 */
CoordinateCalculator.prototype.calculateCAVE2ScreenPos = function(x, y, z) {
	if (y > maxY) {
		if (y < maxY + max_y_error) {
			y = maxY;
		} else {
			screenPos.x = -1;
			screenPos.y = -1;
			return;
		}
	}
	if (y < minY) {
		if (y > minY + max_y_error) {
			y = minY;
		} else {
			screenPos.x = -1;
			screenPos.y = -1;
			return;
		}
	}

	var angle = Math.atan2(x, z);

	if (angle < 0) {
		angle += 2 * Math.PI;
	}
	angle = 2 * Math.PI - angle;
	angle -= radiansForDoor / 2;
	x = angle / (2 * Math.PI - radiansForDoor);
	x += 0.02777777777;
	if (x > 1) {
		if (x < 1 + max_x_error) {
			x = 1;
		} else {
			screenPos.x = -1;
			screenPos.y = -1;
			return;
		}
	}
	if (x < 0) {
		if (x > -max_x_error) {
			x = 0;
		} else {
			screenPos.x = -1;
			screenPos.y = -1;
			return;
		}
	}
	y -= minY;
	y /= (maxY - minY);

	screenPos.x = x;
	screenPos.y = 1 - y;
};

/**
 * Calculate wand to screen intersection
 *
 * @method wandToWallScreenCoordinates
 * @param x {Number} wand x
 * @param y {Number} wand x
 * @param z {Number} wand x
 * @param rx {Number} ray x
 * @param ry {Number} ray y
 * @param rz {Number} ray z
 * @param rw {Number} ray w
 * @return {Object} screen coordinates .x and .y
 */
CoordinateCalculator.prototype.wandToWallScreenCoordinates = function(x, y, z, rx, ry, rz, rw) {
	z *= -1;
	rx *= -1;
	ry *= -1;

	/*
	// Quaternion to Euler ////////////////////////
	// Rotation matrix Q multiplied by reference vector (0,0,-1)
	// 		| 1 - 2y^2 - 2z^2 , 2xy - 2zw, 2xz + 2yw	|		|0	|
	// Q =	| 2xy + 2zw, 1 - 2x^2 - 2z^2, 2yz - 2xw		| * 	|0	|
	// 		| 2xz - 2yw, 2yz + 2xw, 1 - 2x^2 - 2y^2		|		|-1|
	eulerAngles.x = -1 * (2 * rx * rz + 2 * ry * rw);
	eulerAngles.y = -1 * (2 * ry * rz - 2 * rx * rw);
	eulerAngles.z = -1 * (1 - 2 * (rx * rx) - 2 * (ry * ry));

	if (rx * ry + rz * rw === 0.5) {
		// North pole
		eulerAngles.x = 2 * Math.atan2(rx, rw);
		eulerAngles.z = 0;
	} else if (rx * ry + rz * rw === -0.5) {
		// South pole
		eulerAngles.x = -2 * Math.atan2(rx, rw);
		eulerAngles.z = 0;
	}
	// QuaternionToEuler ends ///////////////////

	// https://en.wikipedia.org/wiki/Conversion_between_quaternions_and_Euler_angles
	// Roll
	var sinr = 2.0 * (rw * rx + ry * rz);
	var cosr = 1.0 - 2.0 * (rx * rx + ry * ry);
	eulerAngles.x = Math.atan2(sinr, cosr);

	// Pitch
	var sinp = 2.0 * (rw * ry - rz * rx);
	if (Math.abs(sinp) >= 1.0) {
		if (sinp > 0) {
			eulerAngles.y = Math.PI / 2.0;
		} else {
			eulerAngles.y = -Math.PI / 2.0;
		}
	} else {
		eulerAngles.y = Math.asin(sinp);
	}

	// Yaw
	var siny = 2.0 * (rw * rz + rx * ry);
	var cosy = 1.0 - 2.0 * (ry * ry + rz * rz);
	eulerAngles.z = Math.atan2(siny, cosy);
	*/

	// http://schteppe.github.io/cannon.js/docs/files/src_math_Quaternion.js.html
	var heading, attitude, bank;
	var test = rx * ry + rz * rw;
	if (test > 0.499) { // singularity at north pole
		heading = 2 * Math.atan2(rx, rw);
		attitude = Math.PI / 2;
		bank = 0;
	}
	if (test < -0.499) { // singularity at south pole
		heading = -2 * Math.atan2(rx, rw);
		attitude = -Math.PI / 2;
		bank = 0;
	}
	if (isNaN(heading)) {
		var sqx = rx * rx;
		var sqy = ry * ry;
		var sqz = rz * rz;
		heading = Math.atan2(2 * ry * rw - 2 * rx * rz, 1 - 2 * sqy - 2 * sqz); // Heading
		attitude = Math.asin(2 * test); // attitude
		bank = Math.atan2(2 * rx * rw - 2 * ry * rz, 1 - 2 * sqx - 2 * sqz); // bank
	}

	eulerAngles.z = attitude;
	eulerAngles.y = heading;
	eulerAngles.x = bank;

	/* // Convert to degrees and map 0-360 (debugging)
	eulerAngles.x *= 180.0 / Math.PI;
	eulerAngles.y *= 180.0 / Math.PI;
	eulerAngles.z *= 180.0 / Math.PI;

	if (eulerAngles.x < 0) {
		eulerAngles.x = 360 + eulerAngles.x;
	}
	if (eulerAngles.y < 0) {
		eulerAngles.y = 360 + eulerAngles.y;
	}
	if (eulerAngles.z < 0) {
		eulerAngles.z = 360 + eulerAngles.z;
	}
	*/

	// console.log("wandRot (" + rx + ", " + ry + ", " + rz + ", " + rw + ")" );
	// console.log("wandEuler (" + eulerAngles.x + ", " + eulerAngles.y + ", " + eulerAngles.z + ")" );
	// console.log("wandPos (" + x + ", " + y + ", " + z + ")" );

	// Orientation is vertical
	if (eulerAngles.x === 0 && eulerAngles.z === 0) {
		screenPos.x = -1;
		screenPos.y = -1;
	} else {
		// Wand position projected on wall relative to upper left corner of wall (meters)
		var wallIntersectionPoint = {};
		wallIntersectionPoint.x = -(wallOrigin.x + -x);
		wallIntersectionPoint.y = wallOrigin.y + -y;

		// Perpendicular distance from wand to wall
		var distToWall = z + -wallOrigin.z;

		// Apply y rotation of wand to determine pointer ray
		wallIntersectionPoint.x += -distToWall * Math.tan(eulerAngles.y);

		// Distance from wand's forward vector to wall
		var rayDistToWall = distToWall / Math.cos(eulerAngles.y);

		// Apply x rotation of wand to pointer ray
		wallIntersectionPoint.y += -rayDistToWall * Math.tan(eulerAngles.x);

		// Normalized screen coordinates
		screenPos.x = wallIntersectionPoint.x / wallDim.x;
		screenPos.y = wallIntersectionPoint.y / wallDim.y;
	}
	return screenPos;
};

module.exports = CoordinateCalculator;
